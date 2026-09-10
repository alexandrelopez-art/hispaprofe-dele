import { prisma } from "@/lib/db";
import type { Persona } from "@/lib/generated/prisma";
import { crearSecreto, huellaDe } from "@/lib/puerta/secretos";
import {
  caducidadDelEnlace,
  caducidadDeLaSesion,
  hayQueFrenar,
  motivoParaRechazar,
  sesionCaducada,
  type MotivoDeRechazo,
} from "@/lib/puerta/reglas";
import { mensajeDeEntrada, type Mandar } from "@/lib/correo/mensaje";

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/**
 * Pide un enlace de entrada. No devuelve nada a propósito: quien llama no puede
 * saber si el correo existe, y así la pantalla es idéntica en los dos casos.
 */
export async function pedirEnlace(
  correo: string,
  ahora: Date,
  mandar: Mandar,
  base: string,
): Promise<void> {
  const persona = await prisma.persona.findUnique({ where: { correo: normalizarCorreo(correo) } });
  if (!persona || !persona.activa) return;

  const recientes = await prisma.enlaceDeEntrada.findMany({
    where: { personaId: persona.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (hayQueFrenar(recientes.map((r) => r.createdAt), ahora)) return;

  const { secreto, huella } = crearSecreto();
  await prisma.enlaceDeEntrada.create({
    data: {
      personaId: persona.id,
      secretoHuella: huella,
      expiraEn: caducidadDelEnlace(ahora),
      createdAt: ahora,
    },
  });
  await mandar(mensajeDeEntrada(persona.correo, `${base}/entrar/${secreto}`));
}

export type ResultadoDeEntrada =
  | { cookie: string }
  | { error: MotivoDeRechazo | "desconocido" };

export async function usarEnlace(secreto: string, ahora: Date): Promise<ResultadoDeEntrada> {
  const enlace = await prisma.enlaceDeEntrada.findUnique({
    where: { secretoHuella: huellaDe(secreto) },
  });
  if (!enlace) return { error: "desconocido" };

  const motivo = motivoParaRechazar(enlace, ahora);
  if (motivo) return { error: motivo };

  await prisma.enlaceDeEntrada.update({ where: { id: enlace.id }, data: { usadoEn: ahora } });

  const cookie = crearSecreto();
  await prisma.sesion.create({
    data: {
      personaId: enlace.personaId,
      cookieHuella: cookie.huella,
      expiraEn: caducidadDeLaSesion(ahora),
      ultimaVezEn: ahora,
      createdAt: ahora,
    },
  });
  return { cookie: cookie.secreto };
}

export async function personaDeLaCookie(cookie: string, ahora: Date): Promise<Persona | null> {
  const sesion = await prisma.sesion.findUnique({
    where: { cookieHuella: huellaDe(cookie) },
    include: { persona: true },
  });
  if (!sesion) return null;
  if (sesionCaducada(sesion, ahora)) return null;
  if (!sesion.persona.activa) return null;
  return sesion.persona;
}

export async function cerrarSesion(cookie: string): Promise<void> {
  await prisma.sesion.deleteMany({ where: { cookieHuella: huellaDe(cookie) } });
}
