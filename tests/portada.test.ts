import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

// Antes de esto, la portada era idéntica antes y después de pulsar el
// enlace de entrada: quien entraba no tenía forma de saber si había
// funcionado. Mismos dobles que en tests/puerta-sesion-http.test.ts, porque
// Portada llama a personaDeLaPeticion(), que vive sobre cookies() y
// personaDeLaCookie.
const { cookiesGet, personaDeLaCookie } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));

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
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);

    const marcado = await html();

    expect(marcado).toContain("Hola, Ana");
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
    expect(await html()).not.toContain('href="/examenes"');

    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    expect(await html()).toContain('href="/examenes"');
  });
});
