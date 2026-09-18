import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Estudiantes from "@/app/(sitio)/estudiantes/page";
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
  // borrar `await exigirProfesor()` de app/(sitio)/estudiantes/page.tsx no rompe
  // ninguna prueba, y un estudiante lee los nombres y correos de sus
  // compañeros. Mutación que mata esta prueba: quitar esa línea.
  it("un estudiante topa con el no encontrado, y no se llega a listar a nadie", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);

    await expect(Estudiantes(sinParametros())).rejects.toThrow("NOT_FOUND");
    expect(listarPersonas).not.toHaveBeenCalled();
  });

  it("el profesor entra y se lista", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarPersonas.mockResolvedValue([]);

    await expect(Estudiantes(sinParametros())).resolves.toBeDefined();
    expect(listarPersonas).toHaveBeenCalledTimes(1);
  });
});

describe("la pantalla de estudiantes, vestida con el kit", () => {
  const ANA_PEREZ: Persona = { ...ESTUDIANTE, id: "e2", nombre: "Ana Pérez" };

  function conSesionDeProfesor() {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
  }

  // Mutación que la mata: dejar "Personas" en el h1.
  it("el h1 es Estudiantes", async () => {
    conSesionDeProfesor();
    listarPersonas.mockResolvedValue([]);

    const html = renderToStaticMarkup(await Estudiantes(sinParametros()));

    expect(html).toMatch(/<h1[^>]*>Estudiantes<\/h1>/);
  });

  // Mutación que la mata: enlazar las filas a una ficha que no existe.
  it("con dos personas, ningún <a dentro de la lista", async () => {
    conSesionDeProfesor();
    listarPersonas.mockResolvedValue([ANA_PEREZ, { ...ESTUDIANTE, id: "e3", nombre: "Beto" }]);

    const html = renderToStaticMarkup(await Estudiantes(sinParametros()));
    const listaHtml = html.match(/<ul[^>]*>[\s\S]*?<\/ul>/)![0];

    expect(listaHtml).not.toContain("<a");
  });

  // Mutación que la mata: filtrar por papel y dejar fuera al profesor.
  it("sale el profesor también, con su papel Profesor", async () => {
    conSesionDeProfesor();
    listarPersonas.mockResolvedValue([PROFESOR, ANA_PEREZ]);

    const html = renderToStaticMarkup(await Estudiantes(sinParametros()));

    expect(html).toContain(PROFESOR.nombre);
    expect(html).toContain("Profesor");
  });

  // Mutación que la mata: sacar solo la primera letra ("A" en vez de "AP").
  it("las iniciales de Ana Pérez son AP", async () => {
    conSesionDeProfesor();
    listarPersonas.mockResolvedValue([ANA_PEREZ]);

    const html = renderToStaticMarkup(await Estudiantes(sinParametros()));

    expect(html).toMatch(/>AP</);
  });

  // Mutación que la mata: el aviso de error sigue en azul y sin role="alert".
  it("con ?error=... el aviso sale en un role=alert", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarPersonas.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      await Estudiantes({ searchParams: Promise.resolve({ error: "Ese correo ya existe." }) }),
    );

    expect(html).toMatch(/role="alert"[\s\S]*Ese correo ya existe\./);
  });
});
