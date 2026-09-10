export const MINUTOS_DE_ENLACE = 15;
export const DIAS_DE_SESION = 30;
export const PETICIONES_MAX = 5;
export const MINUTOS_DE_VENTANA = 15;

const MINUTO = 60_000;

export function caducidadDelEnlace(ahora: Date): Date {
  return new Date(ahora.getTime() + MINUTOS_DE_ENLACE * MINUTO);
}

export function caducidadDeLaSesion(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_DE_SESION * 24 * 60 * MINUTO);
}

export type MotivoDeRechazo = "caducado" | "usado";

/** Por qué este enlace no sirve. null = sirve. */
export function motivoParaRechazar(
  enlace: { expiraEn: Date; usadoEn: Date | null },
  ahora: Date,
): MotivoDeRechazo | null {
  if (enlace.usadoEn !== null) return "usado";
  if (enlace.expiraEn.getTime() <= ahora.getTime()) return "caducado";
  return null;
}

export function sesionCaducada(sesion: { expiraEn: Date }, ahora: Date): boolean {
  return sesion.expiraEn.getTime() <= ahora.getTime();
}

/** Cinco peticiones en un cuarto de hora es el tope; la sexta se frena. */
export function hayQueFrenar(peticiones: Date[], ahora: Date): boolean {
  const desde = ahora.getTime() - MINUTOS_DE_VENTANA * MINUTO;
  return peticiones.filter((p) => p.getTime() > desde).length >= PETICIONES_MAX;
}
