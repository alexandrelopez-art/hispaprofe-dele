import type { Papel, Prueba } from "@/lib/generated/prisma";

/** Lo que hace falta de una pieza para el candado: de qué examen y qué prueba cuelga su tarea. */
export type PiezaDelFichero = { tarea: { examenId: string; prueba: Prueba } };

/** Una prueba que la persona que pregunta tiene abierta ahora mismo. Quien llama la calcula; esta función solo la mira. */
export type PruebaAbierta = { examenId: string; prueba: Prueba };

/**
 * Lista blanca: lo que no está dicho aquí, NO se puede ver. Un fichero de un
 * tipo nuevo que nadie haya pensado queda fuera por defecto, que es el lado
 * seguro del error.
 *
 * La tercera rama es la del examen: un estudiante ve un fichero si alguna de
 * sus piezas cuelga de una tarea cuyo examen y prueba están en `abiertas`.
 * Nunca desde una `PaginaDeExamen`: esa tabla no tiene piezas, así que una
 * hoja escaneada no entra por esta rama — es el examen entero en PDF.
 */
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { subidoPorId: string | null; piezas: PiezaDelFichero[] },
  abiertas: readonly PruebaAbierta[],
): boolean {
  if (persona.papel === "PROFESOR") return true;
  if (fichero.subidoPorId !== null && fichero.subidoPorId === persona.id) return true;
  return fichero.piezas.some((pieza) =>
    abiertas.some((abierta) => abierta.examenId === pieza.tarea.examenId && abierta.prueba === pieza.tarea.prueba),
  );
}
