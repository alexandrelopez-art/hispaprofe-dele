import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { cerrarSesion } from "@/lib/puerta/entrada";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { borrarCookie } from "@/lib/puerta/sesion-http";

export async function GET(request: NextRequest) {
  const almacen = await cookies();
  const cookie = almacen.get(NOMBRE_DE_COOKIE)?.value;
  if (cookie) await cerrarSesion(cookie);
  await borrarCookie();
  const respuesta = NextResponse.redirect(new URL("/entrar", request.url), 307);
  // La respuesta borra la cookie de sesión: ninguna caché intermedia debe guardarla.
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
