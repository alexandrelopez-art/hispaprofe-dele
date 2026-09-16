import type { EstadoExamen, Prisma } from "@/lib/generated/prisma";

export const MENSAJE_PUBLICADO = "El examen está publicado: retíralo para editarlo.";
export const MENSAJE_ARCHIVADO = "El examen está archivado: recupéralo para editarlo.";

/** Se lanza dentro de una transacción para deshacerla; quien la abrió devuelve su mensaje. */
export class ExamenNoEditable extends Error {
  constructor(estado: EstadoExamen) {
    super(estado === "ARCHIVADO" ? MENSAJE_ARCHIVADO : MENSAJE_PUBLICADO);
  }
}

/**
 * Bloquea la fila del Examen hasta el final de la transacción y dice en qué
 * estado está (null si no existe). Publicar bloquea la misma fila: así una
 * escritura y una publicación a la vez se ordenan, y ninguna escritura entra
 * en un examen que acaba de publicarse.
 */
export async function bloquearExamen(tx: Prisma.TransactionClient, examenId: string): Promise<EstadoExamen | null> {
  const filas = await tx.$queryRaw<{ estado: EstadoExamen }[]>`SELECT estado FROM "Examen" WHERE id = ${examenId} FOR UPDATE`;
  return filas[0]?.estado ?? null;
}

/** Para las escrituras: bloquea y, si no se puede editar, deshace la transacción. */
export async function exigirEditable(tx: Prisma.TransactionClient, examenId: string): Promise<void> {
  const estado = await bloquearExamen(tx, examenId);
  if (estado === "PUBLICADO" || estado === "ARCHIVADO") throw new ExamenNoEditable(estado);
}
