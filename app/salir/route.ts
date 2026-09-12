import { NextResponse, type NextRequest } from "next/server";
import { cerrarSesion } from "@/lib/puerta/entrada";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { borrarCookie } from "@/lib/puerta/sesion-http";

/**
 * Salir es POST a propósito, NO GET.
 *
 * Con GET se rompía de verdad en producción: Next precarga los enlaces de una
 * pantalla en cuanto se pintan, así que el navegador visitaba /salir sin que
 * nadie lo pulsara y cerraba la sesión recién abierta. Quien entraba se
 * encontraba fuera al pulsar el primer enlace. Lo mismo haría un <img src>
 * en cualquier web ajena.
 *
 * No exportamos GET: si alguien lo vuelve a añadir, la prueba de este fichero
 * se pone roja.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(NOMBRE_DE_COOKIE)?.value;
  if (cookie) await cerrarSesion(cookie);

  // 303 y no 307: el 307 conserva el método, así que el navegador repetiría
  // el POST contra /entrar, que solo sabe responder a GET. El 303 dice
  // «mira esa otra dirección con GET», que es justo lo que hace falta.
  const respuesta = NextResponse.redirect(new URL("/entrar", request.url), 303);
  // La respuesta borra la cookie de sesión: ninguna caché intermedia debe guardarla.
  respuesta.headers.set("Cache-Control", "no-store");
  // La cookie se borra SOBRE la respuesta que se devuelve, no sobre el
  // almacén de next/headers aparte: ver el comentario de ponerCookie en
  // lib/puerta/sesion-http.ts.
  borrarCookie(respuesta);
  return respuesta;
}
