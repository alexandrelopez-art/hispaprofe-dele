// tests/base/taller-paginas.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { borrarDeVercel } = vi.hoisted(() => ({ borrarDeVercel: vi.fn() }));
vi.mock("@/lib/ficheros/vercel", async (original) => ({
  ...(await original<typeof import("@/lib/ficheros/vercel")>()),
  borrarDeVercel,
}));

import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas } from "@/lib/taller/paginas";

beforeEach(async () => {
  borrarDeVercel.mockReset();
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

async function unExamen(): Promise<string> {
  const r = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in r) throw new Error(r.error);
  return r.id;
}

function unFichero(datos: { ruta?: string; tipoMime?: string; almacen?: "VERCEL" | "DRIVE" } = {}) {
  return prisma.fichero.create({
    data: {
      almacen: datos.almacen ?? "VERCEL",
      ruta: datos.ruta ?? `material/${Math.random().toString(36).slice(2)}.jpg`,
      tipoMime: datos.tipoMime ?? "image/jpeg",
      bytes: 1,
    },
  });
}

describe("registrar páginas", () => {
  // Mutación que la mata: ordenar los ficheros por id o por fecha en vez de por su posición.
  it("se guardan en el orden en que llegan, que es el del PDF", async () => {
    const id = await unExamen();
    const [a, b, c] = [await unFichero(), await unFichero(), await unFichero()];
    expect(await registrarPaginas(id, [c.id, a.id, b.id])).toEqual({});
    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id }, orderBy: { orden: "asc" } });
    expect(paginas.map((p) => p.ficheroId)).toEqual([c.id, a.id, b.id]);
  });

  // Mutación que la mata: quitar cualquiera de las tres condiciones del filtro de ficheros.
  it.each([
    ["de Drive", { almacen: "DRIVE" as const }],
    ["un audio", { tipoMime: "audio/mpeg" }],
    ["fuera de la carpeta de material", { ruta: "grabaciones/x.jpg" }],
  ])("un fichero %s no puede ser página, y no se escribe nada", async (_, datos) => {
    const id = await unExamen();
    const bueno = await unFichero();
    const malo = await unFichero(datos);
    expect(await registrarPaginas(id, [bueno.id, malo.id])).toEqual({
      error: "Alguna página no es una imagen subida al almacén de material.",
    });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
  });

  // Mutación que la mata: quitar la comprobación `examen._count.paginas > 0`.
  it("un examen que ya tiene páginas no admite otras encima", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    expect(await registrarPaginas(id, [(await unFichero()).id])).toEqual({
      error: "Este examen ya tiene páginas. Bórralas antes de subir otras.",
    });
  });

  // Mutación que la mata: quitar la comprobación `new Set(ficheroIds).size !== ficheroIds.length`.
  it("una página repetida o una lista vacía", async () => {
    const id = await unExamen();
    const f = await unFichero();
    expect(await registrarPaginas(id, [f.id, f.id])).toEqual({ error: "Una página viene repetida." });
    expect(await registrarPaginas(id, [])).toEqual({ error: "No hay páginas que registrar." });
  });
});

describe("etiquetar una página", () => {
  // Mutación que la mata: guardar `etiquetas` tal cual llega en vez de `validas.filter(...)`.
  it("guarda las etiquetas en el orden del examen y sin repetir", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    const pagina = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id } });
    expect(await etiquetarPagina(id, pagina.id, ["CE-3", "CE-2", "CE-3"])).toEqual({});
    expect((await prisma.paginaDeExamen.findUniqueOrThrow({ where: { id: pagina.id } })).etiquetas).toEqual(["CE-2", "CE-3"]);
  });

  // Mutación que la mata: no comprobar las etiquetas contra el nivel.
  it("una tarea que el examen no tiene rebota", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    const pagina = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id } });
    expect(await etiquetarPagina(id, pagina.id, ["CE-5"])).toEqual({ error: "Esa tarea no existe en este examen." });
  });

  // Mutación que la mata: no comprobar que la página es de ese examen.
  it("la página de otro examen no se toca desde este", async () => {
    const uno = await unExamen();
    const otro = await unExamen();
    await registrarPaginas(otro, [(await unFichero()).id]);
    const ajena = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: otro } });
    expect(await etiquetarPagina(uno, ajena.id, ["CE-1"])).toEqual({ error: "Esa página no existe." });
  });
});

describe("borrar las páginas", () => {
  // Mutación que la mata: no llamar a borrarDeVercel, o llamarlo antes de mirar si se usa.
  it("borra filas y ficheros, y los quita del almacén, salvo lo que use otro examen", async () => {
    const uno = await unExamen();
    const otro = await unFichero();
    const propio = await unFichero();
    const compartido = await unFichero();
    await registrarPaginas(uno, [propio.id, compartido.id]);
    const dos = await unExamen();
    await registrarPaginas(dos, [compartido.id, otro.id]);

    await borrarPaginas(uno);

    expect(await prisma.paginaDeExamen.count({ where: { examenId: uno } })).toBe(0);
    expect(await prisma.fichero.findUnique({ where: { id: propio.id } })).toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: compartido.id } })).not.toBeNull();
    expect(borrarDeVercel).toHaveBeenCalledTimes(1);
    expect(borrarDeVercel).toHaveBeenCalledWith(propio.ruta);
  });
});
