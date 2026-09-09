import type { Prueba } from "@/lib/generated/prisma";
import { ESTRUCTURA, reglaDe } from "@/lib/dele/estructura";

export type TareaParaRevisar = { prueba: Prueba; numero: number; items: number };

const NOMBRE: Record<Prueba, string> = {
  CE: "comprensión de lectura",
  CO: "comprensión auditiva",
  EE: "expresión escrita",
  EO: "expresión oral",
};

/**
 * Por qué este examen no se puede publicar todavía. Lista vacía = se puede.
 *
 * Es la red que caza los errores de la IA al transcribir: una tarea a la que le
 * falta un ítem, o que se coló dos veces, no llega nunca al estudiante.
 */
export function motivosParaNoPublicar(tareas: TareaParaRevisar[]): string[] {
  const motivos: string[] = [];
  const pruebas = Object.keys(ESTRUCTURA) as Prueba[];

  for (const prueba of pruebas) {
    for (const regla of ESTRUCTURA[prueba]) {
      const tarea = tareas.find((t) => t.prueba === prueba && t.numero === regla.numero);
      if (!tarea) {
        motivos.push(`Falta la tarea ${regla.numero} de ${NOMBRE[prueba]} (${prueba}).`);
        continue;
      }
      if (regla.items !== null && tarea.items !== regla.items) {
        motivos.push(
          `La tarea ${regla.numero} de ${NOMBRE[prueba]} tiene que llevar ${regla.items} ítems y lleva ${tarea.items}.`,
        );
      }
    }
  }

  for (const tarea of tareas) {
    if (reglaDe(tarea.prueba, tarea.numero) === null) {
      motivos.push(
        `La tarea ${tarea.numero} de ${NOMBRE[tarea.prueba]} no existe en este examen.`,
      );
    }
  }

  const veces = new Map<string, { prueba: Prueba; numero: number; veces: number }>();
  for (const tarea of tareas) {
    const clave = `${tarea.prueba}-${tarea.numero}`;
    const entrada = veces.get(clave);
    if (entrada) {
      entrada.veces += 1;
    } else {
      veces.set(clave, { prueba: tarea.prueba, numero: tarea.numero, veces: 1 });
    }
  }
  for (const { prueba, numero, veces: repeticiones } of veces.values()) {
    if (repeticiones > 1) {
      motivos.push(
        `La tarea ${numero} de ${NOMBRE[prueba]} (${prueba}) está repetida: aparece ${repeticiones} veces.`,
      );
    }
  }

  return motivos;
}
