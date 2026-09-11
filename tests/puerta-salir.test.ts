import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";

// Igual que /entrar/[secreto], esta ruta no la probaba nadie. El mismo
// riesgo de fondo en sentido contrario: si borrarCookie dejara de aplicarse
// sobre la respuesta de verdad, "salir" no cerraría la sesión en el
// navegador aunque la fila Sesion sí desapareciera de la base.
const { cerrarSesion } = vi.hoisted(() => ({ cerrarSesion: vi.fn() }));
vi.mock("@/lib/puerta/entrada", () => ({ cerrarSesion }));

import { GET } from "@/app/salir/route";

function peticion(cookie?: string) {
  return GET(
    new NextRequest("http://hispaprofe.com/salir", {
      headers: cookie ? { cookie: `${NOMBRE_DE_COOKIE}=${cookie}` } : undefined,
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /salir", () => {
  // Mutación que mata esta prueba: quitar borrarCookie, o volver a
  // cookies().delete() (next/headers) sin aplicarlo a la respuesta.
  it("con sesión, cierra la sesión en la base y la respuesta borra la cookie", async () => {
    const respuesta = await peticion("cookie-de-pablo");
    const cookie = respuesta.cookies.get(NOMBRE_DE_COOKIE);

    expect(cerrarSesion).toHaveBeenCalledWith("cookie-de-pablo");
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/entrar");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
  });

  // Mutación que mata esta prueba: quitar el `if (cookie)` (llamaría a
  // cerrarSesion con undefined aunque no hubiera cookie ninguna).
  it("sin cookie, no llama a cerrarSesion pero igual redirige y borra", async () => {
    const respuesta = await peticion();

    expect(cerrarSesion).not.toHaveBeenCalled();
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/entrar");
  });

  // Mutación que mata esta prueba: quitar la cabecera Cache-Control.
  it("la respuesta lleva la cabecera que impide la caché", async () => {
    const respuesta = await peticion("cookie-de-pablo");
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
  });
});
