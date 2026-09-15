import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona } from "@/lib/generated/prisma";

// Una acción de servidor es una dirección pública: quien la conozca la llama
// sin pasar por la pantalla. Aquí se llama a CADA acción directamente, una por
// una, para que quitar el candado de cualquiera de ellas ponga esto en rojo
// (probar la regla y no el sitio donde se aplica ya nos pilló tres veces).
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  revalidatePath: vi.fn(),
  crearExamen: vi.fn(),
  guardarTarea: vi.fn(),
  publicarExamen: vi.fn(),
  retirarExamen: vi.fn(),
  registrarPaginas: vi.fn(),
  sustituirPaginas: vi.fn(),
  etiquetarPagina: vi.fn(),
  borrarPaginas: vi.fn(),
  guardarCuadernillo: vi.fn(),
  elegirCuadernillo: vi.fn(),
  rellenarTarea: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound }));
vi.mock("next/cache", () => ({ revalidatePath: dobles.revalidatePath }));
vi.mock("@/lib/taller/examenes", () => ({
  crearExamen: dobles.crearExamen,
  guardarTarea: dobles.guardarTarea,
  publicarExamen: dobles.publicarExamen,
  retirarExamen: dobles.retirarExamen,
}));
vi.mock("@/lib/taller/paginas", () => ({
  registrarPaginas: dobles.registrarPaginas,
  sustituirPaginas: dobles.sustituirPaginas,
  etiquetarPagina: dobles.etiquetarPagina,
  borrarPaginas: dobles.borrarPaginas,
}));
vi.mock("@/lib/taller/cuadernillos", () => ({
  guardarCuadernillo: dobles.guardarCuadernillo,
  elegirCuadernillo: dobles.elegirCuadernillo,
}));
vi.mock("@/lib/taller/ia/rellenar", () => ({ rellenarTarea: dobles.rellenarTarea }));

import {
  borrarPaginasAccion,
  crearExamenAccion,
  elegirCuadernilloAccion,
  etiquetarPaginaAccion,
  guardarCuadernilloAccion,
  guardarTareaAccion,
  publicarExamenAccion,
  registrarPaginasAccion,
  rellenarTareaConIAAccion,
  retirarExamenAccion,
  sustituirPaginasAccion,
} from "@/app/examenes/acciones";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona | null) {
  if (!persona) { dobles.cookiesGet.mockReturnValue(undefined); return; }
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

// toThrow(cadena) compara por subcadena; esto captura el mensaje exacto.
async function mensajeDelRechazo(promesa: Promise<unknown>): Promise<string> {
  try { await promesa; } catch (error) { return error instanceof Error ? error.message : String(error); }
  throw new Error("se esperaba que la promesa rechazara, y no lo hizo");
}

const ACCIONES = [
  { nombre: "crearExamenAccion", llamar: () => crearExamenAccion(formulario({ titulo: "X", nivel: "A2_B1_ESCOLAR" })), tocan: [dobles.crearExamen] },
  { nombre: "registrarPaginasAccion", llamar: () => registrarPaginasAccion("x1", ["f1"]), tocan: [dobles.registrarPaginas] },
  { nombre: "sustituirPaginasAccion", llamar: () => sustituirPaginasAccion("x1", ["f1"]), tocan: [dobles.sustituirPaginas] },
  { nombre: "borrarPaginasAccion", llamar: () => borrarPaginasAccion("x1"), tocan: [dobles.borrarPaginas] },
  { nombre: "etiquetarPaginaAccion", llamar: () => etiquetarPaginaAccion("x1", "p1", ["CE-1"]), tocan: [dobles.etiquetarPagina] },
  { nombre: "guardarCuadernilloAccion", llamar: () => guardarCuadernilloAccion("x1", "Libro", []), tocan: [dobles.guardarCuadernillo, dobles.elegirCuadernillo] },
  { nombre: "elegirCuadernilloAccion", llamar: () => elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "1" })), tocan: [dobles.elegirCuadernillo] },
  { nombre: "guardarTareaAccion", llamar: () => guardarTareaAccion("x1", "CE", 3, {}), tocan: [dobles.guardarTarea] },
  { nombre: "publicarExamenAccion", llamar: () => publicarExamenAccion("x1"), tocan: [dobles.publicarExamen] },
  { nombre: "retirarExamenAccion", llamar: () => retirarExamenAccion("x1"), tocan: [dobles.retirarExamen] },
];

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});

describe("cada acción del taller exige al profesor", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de cualquier acción,
  // o cambiarlo por exigirPersona.
  it.each(ACCIONES)("$nombre: un estudiante topa con el no encontrado y no toca nada", async ({ llamar, tocan }) => {
    como(ESTUDIANTE);
    expect(await mensajeDelRechazo(llamar())).toBe("NOT_FOUND");
    for (const f of tocan) expect(f).not.toHaveBeenCalled();
  });

  // Mutación que la mata: la misma de arriba — sin `exigirProfesor()`, quien
  // llama sin sesión ya no topa con REDIRECT:/entrar sino con lo que haga la
  // acción sin candado.
  it.each(ACCIONES)("$nombre: sin sesión, a entrar", async ({ llamar, tocan }) => {
    como(null);
    expect(await mensajeDelRechazo(llamar())).toBe("REDIRECT:/entrar");
    for (const f of tocan) expect(f).not.toHaveBeenCalled();
  });
});

describe("lo que hace cada acción con el profesor", () => {
  beforeEach(() => como(PROFESOR));

  // Mutación que la mata: quitar el `if ("error" in r) redirect(...)` y
  // redirigir siempre a `pantallaDelExamen(r.id)` — el caso con error
  // acabaría en "/examenes/undefined" en vez del "?error=" esperado.
  it("crear un examen lleva a su pantalla, o vuelve con el error exacto", async () => {
    dobles.crearExamen.mockResolvedValue({ id: "e9" });
    expect(await mensajeDelRechazo(crearExamenAccion(formulario({ titulo: "Uno", nivel: "A2_B1_ESCOLAR" })))).toBe("REDIRECT:/examenes/e9");
    expect(dobles.crearExamen).toHaveBeenCalledWith({ titulo: "Uno", nivel: "A2_B1_ESCOLAR" });

    dobles.crearExamen.mockResolvedValue({ error: "El examen necesita un título." });
    expect(await mensajeDelRechazo(crearExamenAccion(formulario({ titulo: "", nivel: "A2_B1_ESCOLAR" })))).toBe(
      `REDIRECT:/examenes?error=${encodeURIComponent("El examen necesita un título.")}`,
    );
  });

  // Mutación que la mata: no comprobar esPrueba antes de llamar a guardarTarea.
  it("guardar una tarea de una prueba inventada no llega a la base", async () => {
    expect(await guardarTareaAccion("x1", "XX", 3, {})).toEqual({ error: "Esa tarea no existe." });
    expect(await guardarTareaAccion("x1", "CE", 2.5, {})).toEqual({ error: "Esa tarea no existe." });
    expect(dobles.guardarTarea).not.toHaveBeenCalled();
  });

  // Mutación que la mata: llamar a `guardarTarea(examenId, prueba, numero + 1, formulario)`.
  it("guardar una tarea devuelve lo que diga la base", async () => {
    dobles.guardarTarea.mockResolvedValue({ estado: { estado: "COMPLETA", motivos: [] } });
    expect(await guardarTareaAccion("x1", "CE", 3, { forma: "OPCIONES" })).toMatchObject({ estado: { estado: "COMPLETA" } });
    expect(dobles.guardarTarea).toHaveBeenCalledWith("x1", "CE", 3, { forma: "OPCIONES" });
  });

  // Mutación que la mata: elegir el cuadernillo aunque guardarlo haya fallado.
  it("un cuadernillo que no se guarda no se elige", async () => {
    dobles.guardarCuadernillo.mockResolvedValue({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(await guardarCuadernilloAccion("x1", "Libro", [])).toEqual({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(dobles.elegirCuadernillo).not.toHaveBeenCalled();
  });

  // Mutación que la mata: elegir con un número fijo (p.ej. 1) en vez de null
  // — `elegirCuadernillo(examenId, guardado.id, 1)`.
  it("un cuadernillo guardado queda elegido para el examen, sin número", async () => {
    dobles.guardarCuadernillo.mockResolvedValue({ id: "c1" });
    dobles.elegirCuadernillo.mockResolvedValue({});
    expect(await guardarCuadernilloAccion("x1", "Libro", [])).toEqual({});
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", "c1", null);
  });

  // Mutación que la mata: pasar Number("abc") (NaN) a elegirCuadernillo.
  it("elegir con un número que no es número vuelve con error y no toca la base", async () => {
    expect(await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "abc" })))).toBe(
      `REDIRECT:/examenes/x1?error=${encodeURIComponent("Ese número de examen no vale.")}`,
    );
    expect(dobles.elegirCuadernillo).not.toHaveBeenCalled();
  });

  // Mutación que la mata: pasar `numeroEscrito` (el string) en vez de `numero`
  // a `elegirCuadernillo` — llegaría "3" en vez de 3.
  it("elegir cuadernillo y número", async () => {
    dobles.elegirCuadernillo.mockResolvedValue({});
    expect(await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "3" })))).toBe("REDIRECT:/examenes/x1");
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", "c1", 3);
  });

  // Mutación que la mata: quitar el `|| null` al leer `cuadernilloId` del
  // formulario — con el campo vacío llegaría "" en vez de null.
  it("elegir sin cuadernillo lo quita", async () => {
    dobles.elegirCuadernillo.mockResolvedValue({});
    await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "", numero: "" })));
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", null, null);
  });

  // Elegir "Ninguno" (sin cuadernillo) quita también el número, aunque el
  // formulario traiga uno puesto: quitar el cuadernillo quita el número
  // (ya probado en la capa de base de datos). Sin esta prueba, el `? numero
  // : null` de más abajo podía cambiarse por `numero` a secas sin que nada
  // lo notara.
  // Mutación que la mata: cambiar `cuadernilloId ? numero : null` por `numero`.
  it("elegir \"Ninguno\" con un número puesto quita cuadernillo y número", async () => {
    dobles.elegirCuadernillo.mockResolvedValue({});
    expect(await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "", numero: "3" })))).toBe("REDIRECT:/examenes/x1");
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", null, null);
  });

  // Mutación que la mata: pasar `ficheroIds.slice().reverse()` a
  // `registrarPaginas` en `registrarPaginasAccion`.
  it("etiquetar y registrar pasan sus datos tal cual", async () => {
    dobles.etiquetarPagina.mockResolvedValue({});
    dobles.registrarPaginas.mockResolvedValue({});
    await etiquetarPaginaAccion("x1", "p1", ["CE-2", "CE-3"]);
    await registrarPaginasAccion("x1", ["f2", "f1"]);
    expect(dobles.etiquetarPagina).toHaveBeenCalledWith("x1", "p1", ["CE-2", "CE-3"]);
    expect(dobles.registrarPaginas).toHaveBeenCalledWith("x1", ["f2", "f1"]);
  });

  // Mutación que la mata: pasar `ficheroIds.slice().reverse()` a
  // `sustituirPaginas` en `sustituirPaginasAccion`, o devolver `{}` fijo en
  // vez de lo que devuelva la capa de base (el error se perdería).
  it("sustituir páginas pasa sus datos tal cual y devuelve lo que diga la base", async () => {
    dobles.sustituirPaginas.mockResolvedValue({ error: "Otra pestaña está subiendo páginas a este examen. Recarga la pantalla." });
    expect(await sustituirPaginasAccion("x1", ["f2", "f1"])).toEqual({
      error: "Otra pestaña está subiendo páginas a este examen. Recarga la pantalla.",
    });
    expect(dobles.sustituirPaginas).toHaveBeenCalledWith("x1", ["f2", "f1"]);
  });

  // Mutación que la mata: redirigir siempre a la pantalla sin el ?error=.
  it("publicar vuelve al examen, con el motivo si no se pudo", async () => {
    dobles.publicarExamen.mockResolvedValue({});
    expect(await mensajeDelRechazo(publicarExamenAccion("x1"))).toBe("REDIRECT:/examenes/x1");
    dobles.publicarExamen.mockResolvedValue({ error: "No se puede publicar: Faltan por completar: CO1." });
    expect(await mensajeDelRechazo(publicarExamenAccion("x1"))).toBe(
      `REDIRECT:/examenes/x1?error=${encodeURIComponent("No se puede publicar: Faltan por completar: CO1.")}`,
    );
  });
});

describe("rellenar con IA", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de rellenarTareaConIAAccion.
  it("un estudiante no puede rellenar: no se llama a la IA", async () => {
    como(ESTUDIANTE);
    await expect(rellenarTareaConIAAccion("x1", "CE", 3)).rejects.toThrow("NOT_FOUND");
    expect(dobles.rellenarTarea).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar la comprobación de esPrueba.
  it("una prueba inventada no llega a la IA", async () => {
    como(PROFESOR);
    expect(await rellenarTareaConIAAccion("x1", "XX", 3)).toEqual({ error: "Esa tarea no existe." });
    expect(dobles.rellenarTarea).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no devolver lo que devuelve rellenarTarea.
  it("el profesor recibe lo que devuelve rellenarTarea, sin revalidar la pantalla", async () => {
    como(PROFESOR);
    dobles.rellenarTarea.mockResolvedValue({ error: "La IA no responde ahora. Prueba en un minuto." });
    expect(await rellenarTareaConIAAccion("x1", "CE", 3)).toEqual({ error: "La IA no responde ahora. Prueba en un minuto." });
    expect(dobles.rellenarTarea).toHaveBeenCalledWith("x1", "CE", 3);
    expect(dobles.revalidatePath).not.toHaveBeenCalled();
  });
});
