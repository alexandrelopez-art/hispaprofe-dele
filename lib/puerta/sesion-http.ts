import { cookies } from "next/headers";
import type { Persona } from "@/lib/generated/prisma";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { personaDeLaCookie } from "@/lib/puerta/entrada";
import { DIAS_DE_SESION } from "@/lib/puerta/reglas";

export async function personaActual(ahora: Date): Promise<Persona | null> {
  const cookie = (await cookies()).get(NOMBRE_DE_COOKIE)?.value;
  return cookie ? personaDeLaCookie(cookie, ahora) : null;
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
