import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { NextResponse } from "next/server";
import type { Persona } from "@/lib/generated/prisma";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { personaDeLaCookie } from "@/lib/puerta/entrada";
import { DIAS_DE_SESION } from "@/lib/puerta/reglas";

// No exportada a propósito, para que ninguna PANTALLA futura pueda mirar la
// sesión saltándose exigirPersona/exigirProfesor (que redirigen). Las rutas
// de datos (app/api/...) no pueden redirigir donde se espera JSON, así que
// tienen su propia envoltura más abajo: personaDeLaPeticion.
async function personaActual(ahora: Date): Promise<Persona | null> {
  const cookie = (await cookies()).get(NOMBRE_DE_COOKIE)?.value;
  return cookie ? personaDeLaCookie(cookie, ahora) : null;
}

/**
 * La persona de ESTA petición, leída una sola vez: el layout de (sitio) y la
 * página la piden los dos, y sin esto cada pantalla consultaba la sesión dos
 * veces. La fecha se toma dentro: una función que recibe `ahora` no se puede
 * cachear (cada llamada trae una fecha distinta).
 */
const personaDeEstaPeticion = cache(async (): Promise<Persona | null> => personaActual(new Date()));

/**
 * La persona de la sesión, o null si no hay ninguna. Es la envoltura para
 * app/api/...: nunca redirige ni da 404, para que quien llama pueda responder
 * con el código HTTP que toque (401 sin sesión, 403 con sesión pero sin
 * permiso). Reutiliza la misma comprobación de cookie que exigirPersona, sin
 * duplicarla.
 *
 * También la usa el layout de app/(sitio)/ para pintar la cabecera: tampoco
 * puede redirigir, porque `/` sin sesión es pública y el layout la envuelve.
 */
export async function personaDeLaPeticion(): Promise<Persona | null> {
  return personaDeEstaPeticion();
}

/**
 * La persona que está mirando la pantalla, o fuera. El guardián solo mira que
 * haya cookie; esta es la comprobación de verdad, y toda pantalla cerrada
 * empieza por aquí.
 */
export async function exigirPersona(): Promise<Persona> {
  const persona = await personaDeEstaPeticion();
  if (!persona) redirect("/entrar");
  return persona;
}

/** Como exigirPersona, pero además exige que sea el profesor. */
export async function exigirProfesor(): Promise<Persona> {
  const persona = await exigirPersona();
  if (persona.papel !== "PROFESOR") notFound();
  return persona;
}

// Las marcas de la cookie, en un único sitio para que ponerCookie y
// borrarCookie nunca diverjan (una cookie borrada con otro `path`, por
// ejemplo, no borra la puesta con este).
function marcasDeLaCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Pone la cookie de sesión SOBRE la respuesta que se va a devolver
 * (`respuesta.cookies.set`), no sobre el almacén de `next/headers` aparte:
 * esa forma antigua deja de aplicarse en cuanto la ruta construye su propio
 * `NextResponse` (como hace app/entrar/[secreto]/route.ts al redirigir), y
 * el resultado es una redirección de 307 que llega SIN cookie — el
 * estudiante aterriza en la portada sin sesión y el enlace ya está gastado.
 * Devuelve la misma respuesta, para poder encadenar.
 */
export function ponerCookie(respuesta: NextResponse, valor: string): NextResponse {
  respuesta.cookies.set(NOMBRE_DE_COOKIE, valor, {
    ...marcasDeLaCookie(),
    maxAge: DIAS_DE_SESION * 24 * 60 * 60,
  });
  return respuesta;
}

/** Como ponerCookie, pero para borrarla: mismas marcas, vida cero. */
export function borrarCookie(respuesta: NextResponse): NextResponse {
  respuesta.cookies.set(NOMBRE_DE_COOKIE, "", { ...marcasDeLaCookie(), maxAge: 0 });
  return respuesta;
}
