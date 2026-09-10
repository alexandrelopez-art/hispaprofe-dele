import { describe, it, expect, vi, afterEach } from "vitest";
import { direccionDelSitio } from "@/lib/puerta/sitio";

// SITIO_URL no está tipada como solo-lectura; NODE_ENV sí lo está (Next.js la
// declara así), por eso esa se toca con vi.stubEnv en vez de una asignación
// directa. vi.unstubAllEnvs() deja NODE_ENV como estaba antes de cada caso.
const SITIO_URL_ORIGINAL = process.env.SITIO_URL;

afterEach(() => {
  vi.unstubAllEnvs();
  if (SITIO_URL_ORIGINAL === undefined) delete process.env.SITIO_URL;
  else process.env.SITIO_URL = SITIO_URL_ORIGINAL;
});

describe("de dónde sale la dirección del sitio", () => {
  // Mutación que mata esta prueba: quitar el .replace(/\/+$/, "") (se vería la
  // barra final), o invertir el `if (declarada)` (usaría la cabecera en vez de
  // la variable). Comprobado a mano: sin el .replace, la prueba se pone roja.
  it("con SITIO_URL puesta, la usa y le quita la barra final", () => {
    process.env.SITIO_URL = "https://hispaprofe.com/";
    expect(direccionDelSitio(new Headers({ host: "otra-cosa.example" }))).toBe(
      "https://hispaprofe.com",
    );
  });

  // Mutación que mata esta prueba: cambiar "http://" por otra cosa, o no leer
  // la cabecera `host` (devolver siempre "localhost:3000"). Comprobado a mano.
  it("sin SITIO_URL y fuera de producción, usa la cabecera host", () => {
    delete process.env.SITIO_URL;
    vi.stubEnv("NODE_ENV", "development");
    const cabeceras = new Headers({ host: "localhost:4000" });
    expect(direccionDelSitio(cabeceras)).toBe("http://localhost:4000");
  });

  // Mutación que mata esta prueba: quitar el throw, invertir la condición
  // `=== "production"`, o quitar "SITIO_URL" del mensaje. Comprobado a mano:
  // invertir la condición también tira abajo la prueba anterior.
  it("sin SITIO_URL y en producción, revienta nombrando SITIO_URL", () => {
    delete process.env.SITIO_URL;
    vi.stubEnv("NODE_ENV", "production");
    expect(() => direccionDelSitio(new Headers())).toThrow(/SITIO_URL/);
  });
});
