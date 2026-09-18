import { describe, it, expect } from "vitest";
import { exigeSesion } from "@/lib/puerta/rutas";

describe("qué rutas exigen sesión", () => {
  // Mutación que mata esta prueba: quitar `if (ruta === "/") return false`
  // (mataría el primer expect), o quitar el `.startsWith` dejando solo la
  // igualdad exacta (mataría los dos últimos, que dependen del prefijo).
  it("deja pasar la portada y todo lo de entrar", () => {
    expect(exigeSesion("/")).toBe(false);
    expect(exigeSesion("/entrar")).toBe(false);
    expect(exigeSesion("/entrar/abc123")).toBe(false);
    expect(exigeSesion("/entrar/enviado")).toBe(false);
  });

  // Mutación que mata esta prueba: quitar la `!` que niega el
  // `ABIERTAS.some(...)`. Ninguna de estas rutas está en ABIERTAS, así que sin
  // la negación las tres pasarían a devolver false (abiertas) en vez de true.
  it("cierra todo lo demás", () => {
    expect(exigeSesion("/estudiantes")).toBe(true);
    expect(exigeSesion("/examenes")).toBe(true);
    expect(exigeSesion("/pruebas/subir")).toBe(true);
  });

  it("no se abre por parecerse: /entrarme no es /entrar", () => {
    // Mutación que mata estos dos: quitar la barra final en `${a}/` y dejar
    // `ruta.startsWith(a)` a secas. Sin esa barra, "/entrarme" y
    // "/entrar-por-detras" empiezan igual por "/entrar" y se abrirían.
    expect(exigeSesion("/entrarme")).toBe(true);
    expect(exigeSesion("/entrar-por-detras")).toBe(true);
    // Esta es la que realmente distingue startsWith de includes: "/entrar/" SÍ
    // aparece dentro de la ruta, pero no al principio. Sin esta aserción, cambiar
    // startsWith por includes no rompe ninguna prueba (comprobado a mano).
    expect(exigeSesion("/x/entrar/y")).toBe(true);
  });

  // Mutación que mata esta prueba: quitar la `!` general (como en "cierra
  // todo lo demás"), o meter por error "/api" en ABIERTAS.
  it("las rutas de datos también están cerradas", () => {
    expect(exigeSesion("/api/ficheros/permiso")).toBe(true);
  });

  // Mutación que mata esta prueba: la que había hasta la ronda de arreglo 1,
  // con ABIERTAS = ["/", "/entrar"] y sin el `if (ruta === "/")` explícito.
  // "/" acababa metido dentro de ABIERTAS, y `ruta.startsWith("/" + "/")` es
  // `ruta.startsWith("//")`: cualquier ruta con doble barra delante quedaba
  // abierta. Comprobado a mano: con el código viejo estas dos se ponían rojas.
  it("una barra doble delante no cuela como la portada", () => {
    expect(exigeSesion("//estudiantes")).toBe(true);
    expect(exigeSesion("//api/ficheros/permiso")).toBe(true);
  });
});
