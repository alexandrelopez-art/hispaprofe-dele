import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
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
 * La persona de la sesión, o null si no hay ninguna. Es la envoltura para
 * app/api/...: nunca redirige ni da 404, para que quien llama pueda responder
 * con el código HTTP que toque (401 sin sesión, 403 con sesión pero sin
 * permiso). Reutiliza la misma comprobación de cookie que exigirPersona, sin
 * duplicarla.
 */
export async function personaDeLaPeticion(): Promise<Persona | null> {
  return personaActual(new Date());
}

/**
 * La persona que está mirando la pantalla, o fuera. El guardián solo mira que
 * haya cookie; esta es la comprobación de verdad, y toda pantalla cerrada
 * empieza por aquí.
 */
export async function exigirPersona(): Promise<Persona> {
  const persona = await personaActual(new Date());
  if (!persona) redirect("/entrar");
  return persona;
}

/** Como exigirPersona, pero además exige que sea el profesor. */
export async function exigirProfesor(): Promise<Persona> {
  const persona = await exigirPersona();
  if (persona.papel !== "PROFESOR") notFound();
  return persona;
}

export async function ponerCookie(valor: string): Promise<void> {
  (await cookies()).set(NOMBRE_DE_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_DE_SESION * 24 * 60 * 60,
  });
}

export async function borrarCookie(): Promise<void> {
  (await cookies()).delete(NOMBRE_DE_COOKIE);
}
