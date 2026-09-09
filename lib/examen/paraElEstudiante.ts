import type { TipoActividad } from "@/lib/generated/prisma";

export type ActividadPublica = { id: string; tipo: TipoActividad; datos: unknown };

/**
 * La única función por la que una actividad sale hacia el navegador del
 * estudiante. Construye un objeto nuevo campo a campo en vez de borrar la
 * clave de uno existente: así, si mañana la actividad gana un campo nuevo con
 * información sensible, no se cuela solo por haberse añadido al modelo.
 */
export function actividadParaElEstudiante(actividad: {
  id: string;
  tipo: TipoActividad;
  datos: unknown;
  clave?: unknown;
}): ActividadPublica {
  return { id: actividad.id, tipo: actividad.tipo, datos: actividad.datos };
}
