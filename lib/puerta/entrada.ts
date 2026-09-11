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
 * Pide un enlace de entrada. No devuelve nada a propósito: el CONTENIDO de la
 * respuesta es idéntico si el correo existe o no, para que la pantalla no
 * delate quién está apuntado. Ojo: no es idéntico en TIEMPO — el camino que
 * sí existe manda un correo de verdad y tarda más, y eso se puede medir. Se
 * deja así a propósito para esta entrega; no lo des por indistinguible.
 */
export async function pedirEnlace(
  correo: string,
  ahora: Date,
  mandar: Mandar,
  base: string,
): Promise<void> {
  const correoNormalizado = normalizarCorreo(correo);
  const persona = await prisma.persona.findUnique({ where: { correo: correoNormalizado } });
  // Los tres motivos por los que este camino vuelve en silencio (nunca por
  // la respuesta, que es idéntica a propósito: ver el comentario de arriba)
  // dejan rastro aquí, en el registro del servidor. Sin esto, cuando un
  // estudiante diga «no me llega nada» no hay forma de saber si el correo no
  // está dado de alta, si la persona está inactiva o si está frenado por el
  // límite de peticiones. Muchos de estos correos son de adolescentes, así
  // que el registro nunca lleva la dirección completa: cuando la persona
  // existe se usa su id (que ya tenemos a mano); cuando no existe no hay id
  // que anotar, así que se anota como mucho el dominio.
  if (!persona) {
    const dominio = correoNormalizado.split("@")[1] ?? "sin dominio";
    console.warn(`pedirEnlace: correo no dado de alta (dominio: ${dominio})`);
    return;
  }
  if (!persona.activa) {
    console.warn(`pedirEnlace: persona inactiva (id ${persona.id})`);
    return;
  }

  const recientes = await prisma.enlaceDeEntrada.findMany({
    where: { personaId: persona.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (hayQueFrenar(recientes.map((r) => r.createdAt), ahora)) {
    console.warn(`pedirEnlace: frenado por el límite de peticiones (id ${persona.id})`);
    return;
  }

  const { secreto, huella } = crearSecreto();
  await prisma.enlaceDeEntrada.create({
    data: {
      personaId: persona.id,
      secretoHuella: huella,
      expiraEn: caducidadDelEnlace(ahora),
      createdAt: ahora,
    },
  });
  try {
    await mandar(mensajeDeEntrada(persona.correo, `${base}/entrar/${secreto}`));
  } catch (error) {
    console.error("No se pudo mandar el correo de entrada", error);
  }
}

export type ResultadoDeEntrada =
  | { cookie: string }
  | { error: MotivoDeRechazo | "desconocido" };

export async function usarEnlace(secreto: string, ahora: Date): Promise<ResultadoDeEntrada> {
  const enlace = await prisma.enlaceDeEntrada.findUnique({
    where: { secretoHuella: huellaDe(secreto) },
    include: { persona: true },
  });
  if (!enlace) return { error: "desconocido" };
  if (!enlace.persona.activa) return { error: "desconocido" };

  const motivo = motivoParaRechazar(enlace, ahora);
  if (motivo) return { error: motivo };

  // Marcado condicional: si dos peticiones llegan a la vez con el mismo
  // secreto, la segunda pierde la carrera y no marca nada (count === 0).
  const marcado = await prisma.enlaceDeEntrada.updateMany({
    where: { id: enlace.id, usadoEn: null },
    data: { usadoEn: ahora },
  });
  if (marcado.count === 0) return { error: "usado" };

  // Un enlace que ya no hace falta no debe seguir sirviendo hasta que caduque.
  await prisma.enlaceDeEntrada.updateMany({
    where: { personaId: enlace.personaId, usadoEn: null },
    data: { usadoEn: ahora },
  });

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
