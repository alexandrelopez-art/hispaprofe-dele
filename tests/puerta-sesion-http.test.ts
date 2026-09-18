import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { exigirPersona, exigirProfesor } from "@/lib/puerta/sesion-http";
import type { Persona } from "@/lib/generated/prisma";

// exigirPersona y exigirProfesor viven sobre cookies() (next/headers),
// personaDeLaCookie (la entrada) y redirect/notFound (next/navigation). Se
// simulan los tres para no depender de una petición HTTP real ni de una base
// de datos: lo que se prueba aquí es la lógica de la comprobación, no el
// almacén.
// vi.mock se eleva por encima de cualquier variable normal, así que las
// funciones simuladas se declaran con vi.hoisted para poder usarlas dentro
// de las factories.
//
// redirect() y notFound() no vuelven en Next: interrumpen la petición
// lanzando. Se simulan igual aquí, con un mensaje que deja ver adónde
// mandaban, para poder comprobarlo con `rejects.toThrow`.
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

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));

// toThrow(cadena) compara por subcadena, así que no basta para distinguir
// mensajes donde uno pudiera ser prefijo de otro. Esta ayuda captura el
// mensaje exacto para compararlo con toBe.
async function mensajeDelRechazo(promesa: Promise<unknown>): Promise<string> {
  let mensaje: string | null = null;
  try {
    await promesa;
  } catch (error) {
    mensaje = error instanceof Error ? error.message : String(error);
  }
  if (mensaje === null) {
    throw new Error("se esperaba que la promesa rechazara, y no lo hizo");
  }
  return mensaje;
}

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

beforeEach(() => {
  // reset, no clear: clearAllMocks no borra los mockResolvedValue fijados en
  // una prueba anterior, y eso dejaba colar el resultado de un test en el
  // siguiente.
  vi.resetAllMocks();
});

// Mutación que la mata: en exigirPersona, volver a `personaActual(new Date())`.
// La sesión se leería dos veces por pantalla, que es lo que cache() quitó.
it("solo la envoltura cacheada llama a personaActual", () => {
  const fuente = readFileSync("lib/puerta/sesion-http.ts", "utf8");
  const llamadas = fuente.match(/personaActual\(/g) ?? [];
  // Una en la definición y una dentro de cache(): ninguna más.
  expect(llamadas).toHaveLength(2);
  expect(fuente).toMatch(/cache\(async \(\): Promise<Persona \| null> => personaActual\(new Date\(\)\)\)/);
});

describe("exigirPersona", () => {
  // Mutación que mata esta prueba: quitar el `if (!persona) redirect(...)`.
  // Sin él, sin cookie exigirPersona devolvería null en vez de mandar a
  // /entrar (y el redirect nunca se llamaría).
  it("sin sesión, manda a /entrar", async () => {
    cookiesGet.mockReturnValue(undefined);
    expect(await mensajeDelRechazo(exigirPersona())).toBe("REDIRECT:/entrar");
    expect(redirect).toHaveBeenCalledWith("/entrar");
    expect(personaDeLaCookie).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: convertir la redirección en incondicional
  // (redirigir siempre, haya o no persona). Con sesión válida no debe
  // redirigir, y la promesa tiene que resolver con la persona, no lanzar.
  it("con sesión, devuelve la persona y no redirige", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    await expect(exigirPersona()).resolves.toEqual(PROFESOR);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("exigirProfesor", () => {
  // Mutación que mata esta prueba: quitar el `if (persona.papel !==
  // "PROFESOR") notFound()`, o invertir la comparación. Un estudiante tiene
  // que toparse con "no encontrado", no con la pantalla.
  it("un estudiante ve la pantalla de no encontrado, no la del profesor", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    expect(await mensajeDelRechazo(exigirProfesor())).toBe("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: invertir la comparación de papel al
  // revés (llamar a notFound() cuando SÍ es profesor). El profesor tiene
  // que poder entrar.
  it("el profesor entra", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    await expect(exigirProfesor()).resolves.toEqual(PROFESOR);
    expect(notFound).not.toHaveBeenCalled();
  });
});
