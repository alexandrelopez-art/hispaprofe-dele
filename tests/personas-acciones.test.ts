import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearPersona } from "@/app/personas/acciones";
import type { Persona } from "@/lib/generated/prisma";

// La pantalla de personas ya llama a exigirProfesor() antes de enseñar el
// formulario, pero la acción es una dirección pública por su cuenta: estas
// pruebas llaman a crearPersona directamente, sin pasar por la pantalla, tal
// como podría hacerlo quien conozca la acción y no sea el profesor.
// vi.mock se eleva por encima de cualquier variable normal, así que las
// funciones simuladas se declaran con vi.hoisted para poder usarlas dentro
// de las factories.
const { cookiesGet, personaDeLaCookie, redirect, notFound, darDeAlta } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  darDeAlta: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/puerta/personas", () => ({ darDeAlta }));

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

function formularioDeAlta(): FormData {
  const formulario = new FormData();
  formulario.set("correo", "nuevo@ejemplo.com");
  formulario.set("nombre", "Nuevo");
  formulario.set("papel", "ESTUDIANTE");
  return formulario;
}

// toThrow(cadena) compara por subcadena: "REDIRECT:/personas" también lo
// cumple "REDIRECT:/personas?error=loquesea", así que no basta para
// distinguir el éxito del error. Esta ayuda captura el mensaje exacto para
// compararlo con toBe.
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

beforeEach(() => {
  // reset, no clear: clearAllMocks no borra los mockResolvedValue fijados en
  // una prueba anterior, y eso dejaba colar el resultado de un test en el
  // siguiente (se pilló probando a mano la mutación del papel inválido).
  vi.resetAllMocks();
});

describe("la acción de dar de alta vuelve a exigir profesor", () => {
  // El caso que el encargo pide comprobar aparte de darDeAlta: sin este
  // guardián en la propia acción, un estudiante que conozca la dirección
  // de crearPersona daría de alta a cualquiera saltándose la pantalla.
  // Mutación que mata esta prueba: quitar el `await exigirProfesor()` del
  // principio de crearPersona, o cambiarlo por exigirPersona (que no exige
  // papel).
  it("un estudiante que llama a la acción directamente no da de alta a nadie", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);

    expect(await mensajeDelRechazo(crearPersona(formularioDeAlta()))).toBe("NOT_FOUND");
    expect(darDeAlta).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: no comprobar la sesión antes de leer el
  // formulario (llamaría a darDeAlta con `quien` indefinido en vez de
  // interrumpir antes).
  it("sin sesión, tampoco da de alta a nadie", async () => {
    cookiesGet.mockReturnValue(undefined);

    expect(await mensajeDelRechazo(crearPersona(formularioDeAlta()))).toBe("REDIRECT:/entrar");
    expect(darDeAlta).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: no leer alguno de los tres campos del
  // formulario, o invertir el `if ("error" in resultado)` (el alta acabaría
  // en /personas?error=undefined en vez de en /personas a secas — y con
  // toThrow por subcadena esa mutación no se pillaba: "REDIRECT:/personas"
  // es subcadena de "REDIRECT:/personas?error=undefined". Por eso la
  // comparación de abajo es exacta, con toBe).
  it("el profesor sí puede, con los tres campos del formulario", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    darDeAlta.mockResolvedValue({ persona: ESTUDIANTE });

    expect(await mensajeDelRechazo(crearPersona(formularioDeAlta()))).toBe("REDIRECT:/personas");
    expect(darDeAlta).toHaveBeenCalledWith(PROFESOR, {
      correo: "nuevo@ejemplo.com",
      nombre: "Nuevo",
      papel: "ESTUDIANTE",
    });
  });

  // Mutación que mata esta prueba: mandar un texto fijo en vez del error
  // real de darDeAlta, o no meterlo en la query de /personas.
  it("si darDeAlta falla, el error llega tal cual a la query de /personas", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    darDeAlta.mockResolvedValue({ error: "Ese correo ya está dado de alta." });

    expect(await mensajeDelRechazo(crearPersona(formularioDeAlta()))).toBe(
      `REDIRECT:/personas?error=${encodeURIComponent("Ese correo ya está dado de alta.")}`,
    );
  });

  // Mutación que mata esta prueba: quitar la comprobación `esPapel` (o
  // hacerla devolver siempre true), dejando pasar un papel inventado hasta
  // darDeAlta, y de ahí hasta Prisma.
  it("un papel que no existe no llega a darDeAlta", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    const formulario = formularioDeAlta();
    formulario.set("papel", "ADMIN");

    expect(await mensajeDelRechazo(crearPersona(formulario))).toBe(
      `REDIRECT:/personas?error=${encodeURIComponent("Ese papel no existe.")}`,
    );
    expect(darDeAlta).not.toHaveBeenCalled();
  });
});
