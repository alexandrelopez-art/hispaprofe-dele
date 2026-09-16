import type { Papel } from "@/lib/generated/prisma";

/**
 * Lista blanca: lo que no está dicho aquí, NO se puede ver. Un fichero de un
 * tipo nuevo que nadie haya pensado queda fuera por defecto, que es el lado
 * seguro del error.
 *
 * Hoy el estudiante no abre nada del examen: la pantalla de hacerlo llega con la
 * 3c, y es ahí donde esta función ganará una rama más («esta pieza es de la
 * tarea que está haciendo ahora»).
 */
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { subidoPorId: string | null },
): boolean {
  if (persona.papel === "PROFESOR") return true;
  return fichero.subidoPorId !== null && fichero.subidoPorId === persona.id;
}
