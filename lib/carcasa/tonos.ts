import type { EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import type { EstadoExamen } from "@/lib/generated/prisma";
import type { Tono } from "@/components/ui/aviso";
import type { EstadoDeTarea } from "@/lib/taller/estado";

/** El color de la etiqueta de cada prueba en el Inicio. Sin estado es modo
 *  libre de lectura/auditiva: no hay nada que colorear. ESPERANDO (una
 *  escrita entregada, todavía sin nota) se pinta igual que ENTREGADA: para
 *  el estudiante ya no queda nada por hacer, solo esperar la corrección. */
export function tonoDelEstado(estado: EstadoDeUnaPrueba | undefined): Tono | "neutro" {
  if (!estado) return "neutro";
  if (estado.estado.estado === "HACIENDO") return "info";
  if (estado.estado.estado === "SIN_EMPEZAR") return "neutro";
  return "exito";
}

/** Repasar lo hecho (o esperar su corrección) es secundario; lo que queda por
 *  hacer, principal. */
export function varianteDelBoton(estado: EstadoDeUnaPrueba | undefined): "principal" | "secundario" {
  return estado && estado.estado.estado !== "SIN_EMPEZAR" && estado.estado.estado !== "HACIENDO" ? "secundario" : "principal";
}

/** El color de la etiqueta de un examen en la lista del profesor: solo
 *  PUBLICADO destaca (es lo que el estudiante ya puede ver); en construcción
 *  y archivado se pintan igual de neutros. */
export function tonoDelExamen(estado: EstadoExamen): Tono | "neutro" {
  return estado === "PUBLICADO" ? "exito" : "neutro";
}

/** El color de la etiqueta de una tarea en el taller. A medias no es un fallo
 *  (es algo por terminar): va en aviso, nunca en error. */
export function tonoDeTarea(estado: EstadoDeTarea["estado"]): Tono | "neutro" {
  if (estado === "COMPLETA") return "exito";
  if (estado === "A_MEDIAS") return "aviso";
  return "neutro";
}
