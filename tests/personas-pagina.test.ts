import { describe, it, expect, vi, beforeEach } from "vitest";
import Personas from "@/app/personas/page";
import type { Persona } from "@/lib/generated/prisma";

// La pantalla llama a exigirProfesor() antes de enseñar nada. Estas pruebas
// importan el propio componente (no un resumen de su lógica) con los mismos
// dobles que en personas-acciones.test.ts, para que borrar esa línea de
// guardián rompa aquí de verdad y no solo en la acción.
const { cookiesGet, personaDeLaCookie, redirect, notFound, darDeAlta, listarPersonas } = vi.hoisted(
  () => ({
    cookiesGet: vi.fn(),
    personaDeLaCookie: vi.fn(),
    redirect: vi.fn((ruta: string) => {
      throw new Error(`REDIRECT:${ruta}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("NOT_FOUND");
    }),
    darDeAlta: vi.fn(),
    listarPersonas: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/puerta/personas", () => ({ darDeAlta, listarPersonas }));

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

function sinParametros() {
  return { searchParams: Promise.resolve({}) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("la pantalla de personas exige profesor", () => {
  // Este es el guardián que el revisor pidió comprobar directamente: sin él,
  // borrar `await exigirProfesor()` de app/personas/page.tsx no rompe
  // ninguna prueba, y un estudiante lee los nombres y correos de sus
  // compañeros. Mutación que mata esta prueba: quitar esa línea.
  it("un estudiante topa con el no encontrado, y no se llega a listar a nadie", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);

    await expect(Personas(sinParametros())).rejects.toThrow("NOT_FOUND");
    expect(listarPersonas).not.toHaveBeenCalled();
  });

  it("el profesor entra y se lista", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarPersonas.mockResolvedValue([]);

    await expect(Personas(sinParametros())).resolves.toBeDefined();
    expect(listarPersonas).toHaveBeenCalledTimes(1);
  });
});
