import type { Papel } from "@/lib/generated/prisma";

/**
 * Lista blanca: lo que no está dicho aquí, NO se puede ver. Un fichero de un
 * tipo nuevo que nadie haya pensado queda fuera por defecto, que es el lado
 * seguro del error.
 *
 * La tercera rama es la del examen, y es una pregunta de pertenencia: ¿está
 * este fichero entre los que alcanzan las pruebas que esta persona tiene
 * abiertas? Quien llama calcula ese conjunto (`ficherosDeLasPruebasAbiertas`,
 * en lib/ficheros/abiertos.ts) y esta función solo lo mira, así que decidir
 * sigue siendo puro y se puede probar solo.
 *
 * Antes esta rama miraba las PIEZAS del fichero, y por eso se veía la pista de
 * audio —que sí es una pieza— pero no las fotos de las opciones, que viven
 * dentro del `datos` de la actividad y no cuelgan de ninguna pieza: en la
 * auditiva 1, donde la respuesta ES la foto, la tarea no se podía hacer. Lo
 * encontró el profesor en la aceptación de la 3c.
 */
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { id: string; subidoPorId: string | null },
  ficherosAbiertos: ReadonlySet<string>,
): boolean {
  if (persona.papel === "PROFESOR") return true;
  if (fichero.subidoPorId !== null && fichero.subidoPorId === persona.id) return true;
  return ficherosAbiertos.has(fichero.id);
}
