import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

// Antes de esto, la portada era idéntica antes y después de pulsar el
// enlace de entrada: quien entraba no tenía forma de saber si había
// funcionado. Mismos dobles que en tests/puerta-sesion-http.test.ts, porque
// Portada llama a personaDeLaPeticion(), que vive sobre cookies() y
// personaDeLaCookie.
const { cookiesGet, personaDeLaCookie, asignacionesDe } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  asignacionesDe: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
// Doblado para que la suite normal nunca arrastre el cliente de Prisma que
// hay detrás de asignacionesDe: sin este doble, `npm test` pediría DATABASE_URL.
vi.mock("@/lib/examen/asignar", () => ({ asignacionesDe }));

import Portada from "@/app/page";

const PROFESOR: Persona = {
  id: "p1",
  correo: "pablo@hispaprofe.com",
  nombre: "Pablo",
  papel: "PROFESOR",
  activa: true,
  createdAt: new Date("2026-01-01"),
};
const ESTUDIANTE: Persona = {
  id: "e1",
  correo: "ana@ejemplo.com",
  nombre: "Ana",
  papel: "ESTUDIANTE",
  activa: true,
  createdAt: new Date("2026-01-01"),
};

async function html(): Promise<string> {
  return renderToStaticMarkup(await Portada());
}

beforeEach(() => {
  vi.resetAllMocks();
  asignacionesDe.mockResolvedValue([]);
});

describe("la portada", () => {
  // Mutación que mata esta prueba: mostrar el saludo también sin persona
  // (quitar el `if (persona)`).
  it("sin sesión, no saluda y ofrece entrar", async () => {
    cookiesGet.mockReturnValue(undefined);

    const marcado = await html();

    expect(marcado).not.toContain("Hola,");
    expect(marcado).toContain('href="/entrar"');
    expect(marcado).not.toContain('href="/salir"');
  });

  // Mutación que mata esta prueba: no interpolar persona.nombre, o quitar
  // el enlace de salir.
  it("con sesión, saluda por su nombre y ofrece salir", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);

    const marcado = await html();

    expect(marcado).toContain("Hola, Pablo");
    // Salir es un formulario POST, no un enlace: con un enlace, la precarga
    // de Next lo visitaba sola y cerraba la sesión recién abierta. Mutación
    // que mata esta prueba: volver a poner <Link href="/salir">.
    expect(marcado).toContain('action="/salir" method="post"');
    expect(marcado).not.toContain('href="/salir"');
    expect(marcado).toContain('href="/pruebas/grabar"');
    expect(marcado).toContain('href="/pruebas/subir"');
  });

  // Mutación que mata esta prueba: quitar el `persona.papel === "PROFESOR"`
  // (un estudiante vería el enlace a la lista de personas de todo el
  // mundo).
  it("un estudiante no ve el enlace a personas", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);

    const marcado = await html();

    expect(marcado).toContain("Hola, Ana"); // que no esté vacío antes de creerse una ausencia
    expect(marcado).not.toContain('href="/personas"');
  });

  // Mutación que mata esta prueba: invertir la comparación de papel, o
  // quitarla del todo (el caso de arriba ya la mata si se quita, pero aquí
  // se comprueba el sentido correcto: el profesor SÍ lo ve).
  it("el profesor sí ve el enlace a personas", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);

    const marcado = await html();

    expect(marcado).toContain('href="/personas"');
  });

  // Mutación que la mata: enseñar «Exámenes» sin mirar el papel.
  it("solo el profesor ve el enlace al taller", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    const deAna = await html();
    expect(deAna).toContain("Hola, Ana"); // que no esté vacío antes de creerse una ausencia
    expect(deAna).not.toContain('href="/examenes"');

    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    expect(await html()).toContain('href="/examenes"');
  });
});

const ASIGNADO = {
  examenId: "x1",
  titulo: "Examen 1",
  // El tope real que produce finDelDiaEnMadrid("2026-10-20"): con huso de
  // Madrid o sin él (bajo TZ=UTC, como corre la suite) cae el mismo día, así
  // que por sí sola esta fecha no distingue si se pintó con huso o no. Se
  // deja porque es el caso que de verdad ve el estudiante.
  nivel: "A2_B1_ESCOLAR" as const,
  modo: "COMPLETO" as const,
  fechaTope: new Date("2026-10-20T21:59:59.999Z"),
};
// A las 23:30 UTC del 20 ya son las 01:30 del 21 en Madrid (CEST, +2): esta sí
// discrepa entre pintar con huso o sin él.
const ASIGNADO_DE_MADRUGADA = {
  examenId: "x2",
  titulo: "Examen 2",
  nivel: "A2_B1_ESCOLAR" as const,
  modo: "COMPLETO" as const,
  fechaTope: new Date("2026-10-20T23:30:00.000Z"),
};

describe("Inicio del estudiante", () => {
  // Mutación que la mata: no pintar la fecha, o pintarla sin huso. La fecha
  // de ASIGNADO_DE_MADRUGADA es la que mata lo segundo: bajo TZ=UTC (como
  // corre esta suite) cae en el 21 de octubre solo si se aplica el huso de
  // Madrid; sin huso saldría el 20. La fecha de ASIGNADO es, además, el tope
  // real que produce finDelDiaEnMadrid, para no perder cobertura del caso
  // normal.
  it("enseña el examen asignado con su fecha en palabras", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([ASIGNADO, ASIGNADO_DE_MADRUGADA]);

    const marcado = await html();

    expect(marcado).toContain("Examen 1");
    expect(marcado).toContain("martes, 20 de octubre de 2026");
    expect(marcado).toContain("Examen 2");
    expect(marcado).toContain("miércoles, 21 de octubre de 2026");
  });

  // Mutación que la mata: quitar la línea de «nada pendiente» y dejar la lista
  // vacía, que no dice si es que no hay nada o si es que falló.
  it("sin nada asignado lo dice en una línea", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([]);

    expect(await html()).toContain("No tienes nada pendiente");
  });

  // Mutación que la mata: no llamar a estaFueraDePlazo, o compararlo al revés.
  it("marca el que se pasó de plazo", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([{ ...ASIGNADO, fechaTope: new Date("2020-01-01T00:00:00Z") }]);

    expect(await html()).toContain("Se pasó el plazo");
  });

  // Mutación que la mata: dejar de mirar el papel para las pantallas de prueba.
  // Un estudiante no tiene nada que hacer en ellas.
  it("un estudiante no ve las pantallas de prueba y el profesor sí", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    const deAna = await html();
    expect(deAna.length).toBeGreaterThan(200); // que no esté vacío antes de creerse una ausencia
    expect(deAna).not.toContain('href="/pruebas/subir"');

    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    expect(await html()).toContain('href="/pruebas/subir"');
  });

  // Mutación que la mata: pedir las asignaciones también para el profesor y
  // pintarle tarjetas vacías en su portada.
  it("al profesor no se le piden asignaciones", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);

    await html();

    expect(asignacionesDe).not.toHaveBeenCalled();
  });
});
