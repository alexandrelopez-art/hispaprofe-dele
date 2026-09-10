import { describe, it, expect } from "vitest";
import { exigeSesion } from "@/lib/puerta/rutas";

describe("qué rutas exigen sesión", () => {
  it("deja pasar la portada y todo lo de entrar", () => {
    expect(exigeSesion("/")).toBe(false);
    expect(exigeSesion("/entrar")).toBe(false);
    expect(exigeSesion("/entrar/abc123")).toBe(false);
    expect(exigeSesion("/entrar/enviado")).toBe(false);
  });

  it("cierra todo lo demás", () => {
    expect(exigeSesion("/personas")).toBe(true);
    expect(exigeSesion("/examenes")).toBe(true);
    expect(exigeSesion("/pruebas/subir")).toBe(true);
  });

  it("no se abre por parecerse: /entrarme no es /entrar", () => {
    expect(exigeSesion("/entrarme")).toBe(true);
    expect(exigeSesion("/entrar-por-detras")).toBe(true);
    // Esta es la que realmente distingue startsWith de includes: "/entrar/" SÍ
    // aparece dentro de la ruta, pero no al principio. Sin esta aserción, cambiar
    // startsWith por includes no rompe ninguna prueba (comprobado a mano).
    expect(exigeSesion("/x/entrar/y")).toBe(true);
  });

  it("las rutas de datos también están cerradas", () => {
    expect(exigeSesion("/api/ficheros/permiso")).toBe(true);
  });
});
