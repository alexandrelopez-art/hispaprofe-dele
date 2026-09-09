import type { Prueba } from "@/lib/generated/prisma";

/** Una tarea del examen. `items` a null es respuesta abierta: no se cuentan. */
export type ReglaTarea = { numero: number; items: number | null };

/**
 * Los números del DELE A2/B1 escolar, verificados contra los cuadernillos.
 * Viven aquí y no en el modelo: el modelo tiene que servir mañana a un
 * examen que el profesor arma a mano, sin reglas de estructura.
 */
export const ESTRUCTURA: Record<Prueba, ReglaTarea[]> = {
  CE: [
    { numero: 1, items: 6 },
    { numero: 2, items: 6 },
    { numero: 3, items: 6 },
    { numero: 4, items: 7 },
  ],
  CO: [
    { numero: 1, items: 7 },
    { numero: 2, items: 6 },
    { numero: 3, items: 6 },
    { numero: 4, items: 6 },
  ],
  EE: [
    { numero: 1, items: null },
    { numero: 2, items: null },
  ],
  EO: [
    { numero: 1, items: null },
    { numero: 2, items: null },
    { numero: 3, items: null },
    { numero: 4, items: null },
  ],
};

export function reglaDe(prueba: Prueba, numero: number): ReglaTarea | null {
  return ESTRUCTURA[prueba].find((r) => r.numero === numero) ?? null;
}
