import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/puerta/sitio.ts está bien probado (tests/puerta-sitio.test.ts), pero
// tiene un solo llamador —esta acción— y ese llamador no lo probaba nadie:
// se podía volver a componer el enlace con la cabecera `host` de la
// petición en vez de con SITIO_URL, y la suite seguía verde, reabriendo la
// fuga que direccionDelSitio existe para cerrar (ver su comentario: con una
// cabecera `host` falsa, alguien podría conseguir que el enlace de ENTRADA
// que le llega a OTRA persona apunte a un dominio suyo).
const { pedirEnlace, redirect } = vi.hoisted(() => ({
  pedirEnlace: vi.fn(),
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
}));
vi.mock("@/lib/puerta/entrada", () => ({ pedirEnlace }));
vi.mock("next/navigation", () => ({ redirect }));
// La cabecera host dice OTRA cosa a propósito: si la acción compusiera el
// enlace con ella en vez de con SITIO_URL, esta prueba lo notaría.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "atacante.example" }),
}));

import { pedirEntrada } from "@/app/entrar/acciones";

const SITIO_URL_ORIGINAL = process.env.SITIO_URL;

function formularioConCorreo(correo: string): FormData {
  const formulario = new FormData();
  formulario.set("correo", correo);
  return formulario;
}

beforeEach(() => {
  vi.resetAllMocks();
  redirect.mockImplementation((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  });
  process.env.SITIO_URL = "https://hispaprofe.com";
});

afterEach(() => {
  if (SITIO_URL_ORIGINAL === undefined) delete process.env.SITIO_URL;
  else process.env.SITIO_URL = SITIO_URL_ORIGINAL;
});

describe("pedirEntrada compone el enlace con SITIO_URL, no con la cabecera host", () => {
  // Mutación que mata esta prueba: cambiar `direccionDelSitio(cabeceras)`
  // por algo que lea `cabeceras.get("host")` directamente en
  // app/entrar/acciones.ts. Con SITIO_URL puesta a "https://hispaprofe.com"
  // y la cabecera host diciendo "atacante.example", el `base` que recibe
  // pedirEnlace tiene que ser el de la variable, nunca el de la cabecera.
  it("con SITIO_URL puesta, el enlace se manda con esa dirección aunque la cabecera diga otra", async () => {
    await expect(pedirEntrada(formularioConCorreo("ana@ejemplo.com"))).rejects.toThrow(
      "REDIRECT:/entrar/enviado",
    );

    expect(pedirEnlace).toHaveBeenCalledTimes(1);
    const [, , , base] = pedirEnlace.mock.calls[0];
    expect(base).toBe("https://hispaprofe.com");
    expect(base).not.toContain("atacante.example");
  });
});
