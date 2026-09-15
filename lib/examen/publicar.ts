import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { ESTRUCTURAS, NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, PRUEBAS } from "@/lib/dele/estructura";

export type TareaParaRevisar = { prueba: Prueba; numero: number; items: number };

const NOMBRE = NOMBRE_DE_PRUEBA;

/**
 * Por qué este examen no se puede publicar todavía. Lista vacía = se puede.
 *
 * Es la red que caza los errores de la IA al transcribir: una tarea a la que le
 * falta un ítem, o que se coló dos veces, no llega nunca al estudiante.
 */
export function motivosParaNoPublicar(nivel: Nivel, tareas: TareaParaRevisar[]): string[] {
  const estructura = ESTRUCTURAS[nivel];
  if (!estructura) {
    return [`Este nivel (${NOMBRE_DE_NIVEL[nivel]}) todavía no tiene sus números: no se puede publicar.`];
  }
  const motivos: string[] = [];

  for (const prueba of PRUEBAS) {
    for (const regla of estructura[prueba]) {
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
    if (!estructura[tarea.prueba].some((r) => r.numero === tarea.numero)) {
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

export type TareaConEstado = TareaParaRevisar & { completa: boolean };

/**
 * Lo que enseña el taller al lado de «Publicar». Primero las tareas a medias,
 * que es lo que el profesor tiene que ir a arreglar. La estructura solo se mira
 * con todas completas: una tarea sin guardar tiene 0 ítems y llenaría la
 * lista de avisos que no dicen nada nuevo.
 */
export function motivosParaPublicar(nivel: Nivel, tareas: TareaConEstado[]): string[] {
  const aMedias = tareas.filter((t) => !t.completa).map((t) => `${t.prueba}${t.numero}`);
  if (aMedias.length > 0) return [`Faltan por completar: ${aMedias.join(", ")}.`];
  return motivosParaNoPublicar(nivel, tareas);
}
