import { NextResponse, type NextRequest } from "next/server";
import { cerrarSesion } from "@/lib/puerta/entrada";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { borrarCookie } from "@/lib/puerta/sesion-http";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(NOMBRE_DE_COOKIE)?.value;
  if (cookie) await cerrarSesion(cookie);

  const respuesta = NextResponse.redirect(new URL("/entrar", request.url), 307);
  // La respuesta borra la cookie de sesión: ninguna caché intermedia debe guardarla.
  respuesta.headers.set("Cache-Control", "no-store");
  // La cookie se borra SOBRE la respuesta que se devuelve, no sobre el
  // almacén de next/headers aparte: ver el comentario de ponerCookie en
  // lib/puerta/sesion-http.ts.
  borrarCookie(respuesta);
  return respuesta;
}
