import { describe, it, expect, beforeEach, vi } from "vitest";

const { borrarDeVercel } = vi.hoisted(() => ({ borrarDeVercel: vi.fn() }));
vi.mock("@/lib/ficheros/vercel", async (original) => ({
  ...(await original<typeof import("@/lib/ficheros/vercel")>()),
  borrarDeVercel,
}));

import { prisma } from "@/lib/db";
import { ESTRUCTURAS, PRUEBAS, letrasHasta, reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import { huecosDeImagen } from "@/lib/taller/medios";
import { crearExamen, examenParaElTaller, guardarTarea, publicarExamen, retirarExamen, tareaParaElTaller } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas, sustituirPaginas } from "@/lib/taller/paginas";
import { elegirCuadernillo } from "@/lib/taller/cuadernillos";
import { rellenarTarea } from "@/lib/taller/ia/rellenar";
import { MENSAJE_PUBLICADO, MENSAJE_ARCHIVADO } from "@/lib/taller/publicado";
import { archivarExamen } from "@/lib/taller/examenes";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

function fichero(tipoMime: string) {
  return prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/${Math.random().toString(36).slice(2)}`, tipoMime, bytes: 1 } });
}

/** Letras inventadas (el repo es público): en relacionar, una distinta por ítem; en las demás, A. */
function solucionesInventadas() {
  const deUna = (prueba: "CE" | "CO") =>
    Object.fromEntries(
      ESCOLAR[prueba].flatMap((r) =>
        Array.from({ length: r.items ?? 0 }, (_, i) => [String(r.primero! + i), r.forma === "RELACIONAR" ? letrasHasta(r.letras)[i] : "A"]),
      ),
    );
  return { "1": { CE: deUna("CE"), CO: deUna("CO") } };
}

function llenar(f: Formulario, fotoId: string, pistaId: string, trozos: number | undefined): Formulario {
  const rellenar = (x: unknown, clave = ""): unknown => {
    if (typeof x === "string") return x === "" && clave !== "letra" ? "algo" : x;
    if (Array.isArray(x)) return x.map((v) => rellenar(v));
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "medios" ? v : rellenar(v, k)]));
    return x;
  };
  const lleno = rellenar(f) as Formulario;
  if (lleno.forma === "RELACIONAR") lleno.actividad.ejemplo.letra = "J";
  if ((lleno.forma === "LISTA_COMUN" || lleno.forma === "OPCIONES") && lleno.actividad.ejemplo) lleno.actividad.ejemplo.letra = "B";
  if (lleno.forma === "HUECOS") lleno.actividad.texto = lleno.actividad.huecos.map((h) => `palabra [${h.numero}]`).join(" ");
  lleno.medios = {
    imagenes: Object.fromEntries(huecosDeImagen(lleno).map((h) => [h.clave, fotoId])),
    audio: trozos ? { fichero: pistaId, cortes: Array.from({ length: trozos - 1 }, (_, i) => (i + 1) * 10) } : null,
  };
  return lleno;
}

/** Un examen con las 14 tareas completas. */
async function examenCompleto(): Promise<string> {
  const cuadernillo = await prisma.cuadernillo.create({ data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: solucionesInventadas() } });
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  await prisma.examen.update({ where: { id: creado.id }, data: { cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 } });
  const [foto, pista] = [await fichero("image/jpeg"), await fichero("audio/mpeg")];
  for (const prueba of PRUEBAS) {
    for (const r of ESCOLAR[prueba]) {
      const g = await guardarTarea(creado.id, prueba, r.numero, llenar(formularioVacio(r), foto.id, pista.id, r.trozos));
      if ("error" in g) throw new Error(`${prueba}${r.numero}: ${g.error}`);
      if (g.estado.estado !== "COMPLETA") throw new Error(`${prueba}${r.numero}: ${g.estado.motivos.join(" ")}`);
    }
  }
  return creado.id;
}

const estadoDe = async (id: string) => (await prisma.examen.findUniqueOrThrow({ where: { id } })).estado;

describe("publicar y retirar", () => {
  // Mutación que la mata: en publicarExamen, no llamar a motivosParaPublicar.
  it("con una tarea a medias no publica y dice cuál", async () => {
    const id = await examenCompleto();
    const co1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    await guardarTarea(id, "CO", 1, co1);
    const r = await publicarExamen(id);
    expect(r.error).toContain("Faltan por completar: CO1.");
    expect(await estadoDe(id)).toBe("EN_CONSTRUCCION");
    expect((await examenParaElTaller(id))!.motivosParaPublicar).toEqual(["Faltan por completar: CO1."]);
  });

  // Mutación que la mata: en retirarExamen, no filtrar por estado PUBLICADO.
  it("completo se publica; retirar lo devuelve a construcción, y retirar dos veces falla", async () => {
    const id = await examenCompleto();
    expect((await examenParaElTaller(id))!.motivosParaPublicar).toEqual([]);
    expect(await publicarExamen(id)).toEqual({});
    expect(await estadoDe(id)).toBe("PUBLICADO");
    expect((await tareaParaElTaller(id, "CE", 1))!.publicado).toBe(true);
    expect(await retirarExamen(id)).toEqual({});
    expect(await estadoDe(id)).toBe("EN_CONSTRUCCION");
    expect(await retirarExamen(id)).toEqual({ error: "Ese examen no está publicado." });
  });
});

describe("un examen publicado no se escribe", () => {
  async function publicado() {
    const id = await examenCompleto();
    const r = await publicarExamen(id);
    if (r.error) throw new Error(r.error);
    return id;
  }

  // Mutación que la mata: quitar la comprobación de exigirEditable en guardarTarea.
  it("guardar una tarea se rechaza y no toca las piezas", async () => {
    const id = await publicado();
    const antes = await prisma.pieza.findMany({ orderBy: { id: "asc" } });
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    expect(await guardarTarea(id, "CE", 3, f)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await prisma.pieza.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
  });

  // Mutación que la mata: quitar la comprobación en cualquiera de las cinco funciones.
  it("páginas y cuadernillo se rechazan", async () => {
    const id = await publicado();
    const hoja = await fichero("image/jpeg");
    expect(await registrarPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await sustituirPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await borrarPaginas(id)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await elegirCuadernillo(id, null, null)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
    expect((await prisma.examen.findUniqueOrThrow({ where: { id } })).cuadernilloId).not.toBeNull();
  });

  // Mutación que la mata: quitar exigirEditable de etiquetarPagina en lib/taller/paginas.ts.
  it("etiquetar una página se rechaza", async () => {
    const id = await examenCompleto();
    const hoja = await fichero("image/jpeg");
    const pagina = await prisma.paginaDeExamen.create({ data: { examenId: id, ficheroId: hoja.id, orden: 1 } });
    await publicarExamen(id);
    expect(await etiquetarPagina(id, pagina.id, ["CE-1"])).toEqual({ error: MENSAJE_PUBLICADO });
    expect((await prisma.paginaDeExamen.findUniqueOrThrow({ where: { id: pagina.id } })).etiquetas).toEqual([]);
  });

  // Mutación que la mata: en rellenarTarea, mirar el estado después de llamar a la IA (se paga una llamada inútil).
  it("rellenar con IA se rechaza sin llamar a la IA", async () => {
    const id = await publicado();
    const leer = vi.fn();
    const r = await rellenarTarea(id, "CE", 3, { leer, descargar: vi.fn(), hayClave: () => true, reloj: () => 0, apuntar: vi.fn() });
    expect(r).toEqual({ error: MENSAJE_PUBLICADO });
    expect(leer).not.toHaveBeenCalled();
  });
});

describe("un examen archivado tampoco se escribe", () => {
  // Mutación que la mata: dejar exigirEditable mirando solo PUBLICADO. Es el
  // agujero que abre Archivar: un examen fuera de circulación se podría seguir
  // editando, y al recuperarlo nadie sabría qué cambió.
  it("guardar una tarea o tocar las páginas se rechaza con el mensaje de archivado", async () => {
    const id = await examenCompleto();
    expect(await archivarExamen(id)).toEqual({});
    const hoja = await fichero("image/jpeg");

    const co1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    expect(await guardarTarea(id, "CO", 1, co1)).toEqual({ error: MENSAJE_ARCHIVADO });
    expect(await registrarPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_ARCHIVADO });
    expect(await elegirCuadernillo(id, null, null)).toEqual({ error: MENSAJE_ARCHIVADO });
    // Sin deps.hayClave forzado a true, esto fallaría antes con «Falta la clave
    // de la IA.»: no hay ANTHROPIC_API_KEY en el entorno de pruebas.
    const leer = vi.fn();
    expect(await rellenarTarea(id, "CO", 1, { leer, descargar: vi.fn(), hayClave: () => true, reloj: () => 0, apuntar: vi.fn() })).toEqual({
      error: MENSAJE_ARCHIVADO,
    });
    expect(leer).not.toHaveBeenCalled();
  });

  // Mutación que la mata: dejar que publicarExamen publique un archivado.
  it("y no se publica", async () => {
    const id = await examenCompleto();
    await archivarExamen(id);
    expect(await publicarExamen(id)).toEqual({ error: "Un examen archivado no se publica." });
  });
});
