import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona } from "@/lib/generated/prisma";

// Cada pantalla se importa tal cual (no un resumen de su lógica), para que
// borrar su `await exigirProfesor()` ponga esto en rojo.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  listarExamenes: vi.fn(),
  examenParaElTaller: vi.fn(),
  tareaParaElTaller: vi.fn(),
  listarCuadernillos: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/taller/examenes", () => ({
  listarExamenes: dobles.listarExamenes,
  examenParaElTaller: dobles.examenParaElTaller,
  tareaParaElTaller: dobles.tareaParaElTaller,
}));
vi.mock("@/lib/taller/cuadernillos", () => ({ listarCuadernillos: dobles.listarCuadernillos }));
// Cada acción que importan las pantallas o sus componentes tiene que existir en
// el doble: Vitest revienta al leer una exportación que el doble no define.
vi.mock("@/app/examenes/acciones", () => ({
  crearExamenAccion: vi.fn(),
  elegirCuadernilloAccion: vi.fn(),
  registrarPaginasAccion: vi.fn(),
  borrarPaginasAccion: vi.fn(),
  etiquetarPaginaAccion: vi.fn(),
  guardarCuadernilloAccion: vi.fn(),
  guardarTareaAccion: vi.fn(),
}));

import Examenes from "@/app/examenes/page";
import PantallaDelExamen from "@/app/examenes/[id]/page";
import PantallaDeTarea from "@/app/examenes/[id]/[prueba]/[numero]/page";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona) {
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

const sinError = () => Promise.resolve({});

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});

const PANTALLAS = [
  { nombre: "la lista de exámenes", pintar: () => Examenes({ searchParams: sinError() }), lee: dobles.listarExamenes },
  { nombre: "la pantalla del examen", pintar: () => PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }), lee: dobles.examenParaElTaller },
  { nombre: "la pantalla de una tarea", pintar: () => PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "3" }) }), lee: dobles.tareaParaElTaller },
];

describe("las pantallas del taller exigen al profesor", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de cualquiera de las tres.
  it.each(PANTALLAS)("$nombre: un estudiante topa con el no encontrado y no se lee nada", async ({ pintar, lee }) => {
    como(ESTUDIANTE);
    await expect(pintar()).rejects.toThrow("NOT_FOUND");
    expect(lee).not.toHaveBeenCalled();
  });
});

describe("lo que no existe da el no encontrado", () => {
  beforeEach(() => como(PROFESOR));

  // Mutación que la mata: quitar `if (!examen) notFound();` en app/examenes/[id]/page.tsx.
  it("un examen que no existe", async () => {
    dobles.examenParaElTaller.mockResolvedValue(null);
    await expect(PantallaDelExamen({ params: Promise.resolve({ id: "nada" }), searchParams: sinError() })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: no comprobar esPrueba antes de ir a la base.
  it("una prueba inventada o un número que no es número no llegan a la base", async () => {
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "XX", numero: "3" }) })).rejects.toThrow("NOT_FOUND");
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "tres" }) })).rejects.toThrow("NOT_FOUND");
    expect(dobles.tareaParaElTaller).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar `if (!tarea) notFound();` en app/examenes/[id]/[prueba]/[numero]/page.tsx.
  it("una tarea que no existe", async () => {
    dobles.tareaParaElTaller.mockResolvedValue(null);
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "9" }) })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: en app/examenes/page.tsx, cambiar
  // `Promise.all([listarExamenes(), searchParams])` por
  // `Promise.all([searchParams, listarExamenes()])` sin tocar la
  // desestructuración: `examenes` pasa a ser el resultado de `searchParams`
  // ({}), `.map` no existe en un objeto y la pantalla revienta en vez de
  // resolver.
  it("el profesor ve la lista", async () => {
    dobles.listarExamenes.mockResolvedValue([]);
    await expect(Examenes({ searchParams: sinError() })).resolves.toBeDefined();
  });
});
