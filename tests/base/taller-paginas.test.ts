// tests/base/taller-paginas.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { borrarDeVercel } = vi.hoisted(() => ({ borrarDeVercel: vi.fn() }));
vi.mock("@/lib/ficheros/vercel", async (original) => ({
  ...(await original<typeof import("@/lib/ficheros/vercel")>()),
  borrarDeVercel,
}));

import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas, sustituirPaginas } from "@/lib/taller/paginas";

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

  // Mutación que la mata: quitar el try/catch de P2002 alrededor de `createMany`. Se repite
  // 10 veces sobre exámenes nuevos porque la carrera depende del entrelazado real de
  // dos conexiones a Postgres, no es determinista con una sola pasada.
  it("dos registros a la vez para el mismo examen: uno gana, el otro rebota limpio", async () => {
    for (let i = 0; i < 10; i++) {
      const id = await unExamen();
      const a = await unFichero();
      const b = await unFichero();
      const resultados = await Promise.all([registrarPaginas(id, [a.id]), registrarPaginas(id, [b.id])]);

      const ganadores = resultados.filter((r) => Object.keys(r).length === 0);
      const perdedores = resultados.filter((r) => "error" in r);
      expect(ganadores).toHaveLength(1);
      expect(perdedores).toEqual([{ error: "Este examen ya tiene páginas. Bórralas antes de subir otras." }]);
      expect(await prisma.paginaDeExamen.count({ where: { examenId: id } })).toBe(1);
    }
  });
});

describe("sustituir páginas", () => {
  // Mutación que la mata: quitar `await tx.paginaDeExamen.deleteMany(...)` de
  // la transacción (dejando las dos tandas de orden a la vez). Con las
  // páginas antiguas en orden 1 y 2 todavía puestas, el `createMany` de las
  // nuevas chocaría contra @@unique([examenId, orden]) y esto devolvería el
  // error de "otra pestaña" en vez de `{}`.
  it("sustituye las páginas de un examen que ya tenía dos, etiquetadas, y limpia sus ficheros y el almacén", async () => {
    const id = await unExamen();
    const viejo1 = await unFichero();
    const viejo2 = await unFichero();
    await registrarPaginas(id, [viejo1.id, viejo2.id]);
    const primera = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id, orden: 1 } });
    await etiquetarPagina(id, primera.id, ["CE-1"]);

    const nuevo1 = await unFichero();
    const nuevo2 = await unFichero();
    const nuevo3 = await unFichero();
    expect(await sustituirPaginas(id, [nuevo3.id, nuevo1.id, nuevo2.id])).toEqual({});

    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id }, orderBy: { orden: "asc" } });
    expect(paginas.map((p) => p.ficheroId)).toEqual([nuevo3.id, nuevo1.id, nuevo2.id]);
    expect(paginas.every((p) => p.etiquetas.length === 0)).toBe(true);

    expect(await prisma.fichero.findUnique({ where: { id: viejo1.id } })).toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: viejo2.id } })).toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: nuevo1.id } })).not.toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: nuevo2.id } })).not.toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: nuevo3.id } })).not.toBeNull();
    expect(borrarDeVercel).toHaveBeenCalledTimes(2);
    expect(borrarDeVercel).toHaveBeenCalledWith(viejo1.ruta);
    expect(borrarDeVercel).toHaveBeenCalledWith(viejo2.ruta);
  });

  // Mutación que la mata: quitar la comprobación de ficheros válidos (el
  // `if (ficheroIds.some((id) => !validos.has(id))) return { error: ... }`)
  // antes de entrar a la transacción.
  it("si la lista de páginas nuevas no vale, las páginas y etiquetas antiguas quedan intactas", async () => {
    const id = await unExamen();
    const viejo = await unFichero();
    await registrarPaginas(id, [viejo.id]);
    const pagina = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id } });
    await etiquetarPagina(id, pagina.id, ["CE-1"]);

    const malo = await unFichero({ tipoMime: "audio/mpeg" });
    expect(await sustituirPaginas(id, [malo.id])).toEqual({
      error: "Alguna página no es una imagen subida al almacén de material.",
    });

    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id } });
    expect(paginas).toHaveLength(1);
    expect(paginas[0].ficheroId).toBe(viejo.id);
    expect(paginas[0].etiquetas).toEqual(["CE-1"]);
    expect(borrarDeVercel).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar el try/catch alrededor de `await
  // borrarDeVercel(...)` dentro de `limpiarSiHuerfanos`, dejando que su
  // fallo se propague y tire abajo (con una excepción) un registro que la
  // transacción ya confirmó.
  it("si borrar del almacén falla después de sustituir, las páginas nuevas quedan registradas igual", async () => {
    const errorConsola = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await unExamen();
    const viejo = await unFichero();
    await registrarPaginas(id, [viejo.id]);
    borrarDeVercel.mockRejectedValueOnce(new Error("almacén caído"));

    const nuevo = await unFichero();
    expect(await sustituirPaginas(id, [nuevo.id])).toEqual({});

    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id } });
    expect(paginas.map((p) => p.ficheroId)).toEqual([nuevo.id]);
    expect(await prisma.fichero.findUnique({ where: { id: viejo.id } })).toBeNull();
    expect(borrarDeVercel).toHaveBeenCalledWith(viejo.ruta);
    errorConsola.mockRestore();
  });

  // Mutación que la mata: invertir el orden al construir las filas nuevas
  // dentro de la transacción (`ficheroIds.slice().reverse().map(...)`) — las
  // páginas quedarían en el orden opuesto al del PDF.
  it("un examen sin páginas también se puede cargar con sustituirPaginas", async () => {
    const id = await unExamen();
    const a = await unFichero();
    const b = await unFichero();
    expect(await sustituirPaginas(id, [a.id, b.id])).toEqual({});
    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id }, orderBy: { orden: "asc" } });
    expect(paginas.map((p) => p.ficheroId)).toEqual([a.id, b.id]);
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

  // Mutación que la mata: quitar el try/catch alrededor de `await borrarDeVercel(...)` en el bucle.
  it("si el almacén falla al borrar un fichero, sigue con los demás", async () => {
    const errorConsola = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await unExamen();
    const uno = await unFichero();
    const dos = await unFichero();
    await registrarPaginas(id, [uno.id, dos.id]);
    borrarDeVercel.mockRejectedValueOnce(new Error("almacén caído"));

    await expect(borrarPaginas(id)).resolves.toBeUndefined();

    expect(await prisma.fichero.findUnique({ where: { id: uno.id } })).toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: dos.id } })).toBeNull();
    expect(borrarDeVercel).toHaveBeenCalledTimes(2);
    errorConsola.mockRestore();
  });

  // Mutación que la mata: quitar `(await prisma.pieza.count({ where: { ficheroId: fichero.id } }))` del cálculo de `enUso`.
  it("un fichero que también usa una pieza no se borra ni se toca en el almacén", async () => {
    const id = await unExamen();
    const compartido = await unFichero();
    await registrarPaginas(id, [compartido.id]);
    const tarea = await prisma.tarea.findFirstOrThrow({ where: { examenId: id } });
    await prisma.pieza.create({ data: { tareaId: tarea.id, orden: 1, tipo: "IMAGEN", ficheroId: compartido.id } });

    await borrarPaginas(id);

    expect(await prisma.paginaDeExamen.count({ where: { examenId: id } })).toBe(0);
    expect(await prisma.fichero.findUnique({ where: { id: compartido.id } })).not.toBeNull();
    expect(borrarDeVercel).not.toHaveBeenCalled();
  });
});
