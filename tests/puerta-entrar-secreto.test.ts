import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";

// Ninguna prueba tocaba antes esta ruta. Y hay un riesgo concreto: pone la
// cookie con cookies().set() (el almacén aparte de next/headers) y LUEGO
// devuelve un NextResponse construido aparte — ese patrón deja de aplicar la
// cookie en cuanto se construye la propia respuesta, y el estudiante
// aterriza en la portada SIN sesión con el enlace ya gastado. Estas pruebas
// miran la respuesta de verdad (sus cookies, no un almacén simulado aparte),
// para que ese fallo concreto no pueda volver sin que algo se ponga rojo.
const { usarEnlace } = vi.hoisted(() => ({ usarEnlace: vi.fn() }));
vi.mock("@/lib/puerta/entrada", () => ({ usarEnlace }));

import { GET } from "@/app/entrar/[secreto]/route";

function peticion(secreto: string) {
  return GET(new NextRequest(`http://hispaprofe.com/entrar/${secreto}`), {
    params: Promise.resolve({ secreto }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /entrar/[secreto]", () => {
  // Mutación que mata esta prueba: volver a poner la cookie sobre
  // cookies() (next/headers) en vez de sobre la respuesta, o quitar la
  // llamada a ponerCookie. Comprobado a mano con el código de antes del
  // arreglo: la cookie no aparecía en la respuesta.
  it("con un enlace bueno, la respuesta lleva la cookie de sesión puesta", async () => {
    usarEnlace.mockResolvedValue({ cookie: "cookie-de-verdad", papel: "ESTUDIANTE" });

    const respuesta = await peticion("secreto-bueno");
    const cookie = respuesta.cookies.get(NOMBRE_DE_COOKIE);

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/");
    expect(cookie?.value).toBe("cookie-de-verdad");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  // Mutación que mata esta prueba: poner la cookie también en el camino de
  // error (o no redirigir a /entrar con el motivo).
  it("con un enlace malo, redirige al aviso y NO lleva cookie", async () => {
    usarEnlace.mockResolvedValue({ error: "caducado" });

    const respuesta = await peticion("secreto-malo");

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/entrar?fallo=caducado");
    expect(respuesta.cookies.get(NOMBRE_DE_COOKIE)).toBeUndefined();
  });

  // Mutación que mata esta prueba: quitar el sinCache de cualquiera de los
  // dos caminos.
  it("las dos respuestas llevan la cabecera que impide la caché", async () => {
    usarEnlace.mockResolvedValueOnce({ cookie: "c", papel: "ESTUDIANTE" });
    const buena = await peticion("secreto-bueno");
    expect(buena.headers.get("Cache-Control")).toBe("no-store");

    usarEnlace.mockResolvedValueOnce({ error: "usado" });
    const mala = await peticion("secreto-malo");
    expect(mala.headers.get("Cache-Control")).toBe("no-store");
  });

  // Un secreto desconocido se trata como caducado de cara al aviso, sin
  // delatar que "desconocido" es un motivo distinto de rechazo.
  it("un secreto desconocido se anuncia como caducado", async () => {
    usarEnlace.mockResolvedValue({ error: "desconocido" });

    const respuesta = await peticion("secreto-inventado");

    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/entrar?fallo=caducado");
  });

  // Mutación que la mata: redirigir siempre a "/". El profesor daría dos saltos y
  // vería un instante el esqueleto del Inicio del estudiante.
  it("el profesor entra directo a Pendientes", async () => {
    usarEnlace.mockResolvedValue({ cookie: "c", papel: "PROFESOR" });

    const respuesta = await peticion("secreto-de-profesor");

    expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/pendientes");
  });
});
