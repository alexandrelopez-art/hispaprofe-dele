import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

const { cookiesGet, personaDeLaCookie, redirect, notFound } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import Muestrario from "@/app/(sitio)/muestrario/page";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

beforeEach(() => vi.resetAllMocks());

describe("el muestrario", () => {
  // Mutación que la mata: quitar el exigirProfesor.
  it("un estudiante topa con el 404", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    await expect(Muestrario()).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: olvidar una de las diez piezas.
  it("el profesor ve las diez piezas por su nombre", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    const html = renderToStaticMarkup(await Muestrario());
    for (const pieza of ["Boton", "Enlace", "Tarjeta", "Aviso", "EtiquetaEstado", "Campo", "Casilla", "Desplegable", "EncabezadoPagina", "BloqueVacio"]) {
      expect(html).toContain(`id="pieza-${pieza}"`);
    }
  });

  // Mutación que la mata: quitar la sección de GrupoDeOpciones del muestrario.
  it("el muestrario enseña el GrupoDeOpciones sin control (valorInicial)", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    const html = renderToStaticMarkup(await Muestrario());
    expect(html).toContain('name="muestra-banda-vacia"');
  });
});
