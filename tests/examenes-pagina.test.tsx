import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Examenes from "@/app/(sitio)/examenes/page";
import type { Persona } from "@/lib/generated/prisma";

// La pantalla llama a exigirProfesor() antes de enseñar nada. Mismos dobles
// que en tests/personas-pagina.test.ts, y además listarExamenes (la única
// función que la pantalla toma de lib/taller/examenes) y ./acciones: la
// pantalla importa crearExamenAccion desde ahí, y ese fichero arrastra media
// docena de módulos de servidor (correo, IA, prisma...) que no hacen falta
// para pintar la lista.
const { cookiesGet, personaDeLaCookie, redirect, notFound, listarExamenes } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  listarExamenes: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/taller/examenes", () => ({ listarExamenes }));
vi.mock("@/app/(sitio)/examenes/acciones", () => ({ crearExamenAccion: vi.fn() }));

const PROFESOR: Persona = {
  id: "p1",
  correo: "pablo@hispaprofe.com",
  nombre: "Pablo",
  papel: "PROFESOR",
  activa: true,
  createdAt: new Date("2026-01-01"),
};

function sinParametros() {
  return { searchParams: Promise.resolve({}) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("la pantalla de exámenes", () => {
  // Mutación que la mata: quitar la tilde del título ("Examenes" en vez de
  // "Exámenes") en el EncabezadoPagina.
  it("el h1 es Exámenes y hay un enlace a #nuevo con el texto Nuevo examen", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarExamenes.mockResolvedValue([]);

    const html = renderToStaticMarkup(await Examenes(sinParametros()));

    expect(html).toMatch(/<h1[^>]*>Exámenes<\/h1>/);
    expect(html).toMatch(/<a[^>]*href="#nuevo"[^>]*>Nuevo examen<\/a>/);
  });

  // Mutación que la mata: copiar el nombre del dibujo (Borrador) en vez del
  // nombre real del estado (Publicado).
  it("con un examen publicado sale Publicado y no Borrador", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarExamenes.mockResolvedValue([
      { id: "e1", titulo: "Examen de prueba", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" },
    ]);

    const html = renderToStaticMarkup(await Examenes(sinParametros()));

    expect(html).toContain("Publicado");
    expect(html).not.toContain("Borrador");
  });

  // Mutación que la mata: volver al placeholder sin etiqueta (quitar los
  // <label for=...> de Campo y Desplegable).
  it("el formulario tiene id=nuevo en el h2, y las etiquetas del título y el nivel", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarExamenes.mockResolvedValue([]);

    const html = renderToStaticMarkup(await Examenes(sinParametros()));

    expect(html).toMatch(/<h2[^>]*id="nuevo"[^>]*>Nuevo examen<\/h2>/);
    expect(html).toContain('<label for="titulo-nuevo"');
    expect(html).toContain('<label for="nivel-nuevo"');
  });

  // Mutación que la mata: el BloqueVacio pierde su borde (border-dashed) y
  // se confunde con un párrafo cualquiera.
  it("sin exámenes sale Todavía no hay ningún examen dentro de un bloque vacío", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    listarExamenes.mockResolvedValue([]);

    const html = renderToStaticMarkup(await Examenes(sinParametros()));

    expect(html).toContain("Todavía no hay ningún examen");
    expect(html).toMatch(/border-dashed[^>]*>[\s\S]*Todavía no hay ningún examen/);
  });
});
