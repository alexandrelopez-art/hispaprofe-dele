/**
 * «a», «a y b», «a, b y c». Lo leen el estudiante justo antes de entregar («Ojo:
 * la tarea 1 está en blanco y no has elegido opción en la tarea 2») y el
 * profesor al firmar («Te faltan notas en las tareas 1 y 2»): en ninguno de los
 * dos sitios valen las listas pegadas con comas.
 *
 * Vive aquí, y no en `hacer-escrita.tsx` ni en `notas.ts`, porque es
 * castellano puro y nada más: no sabe de folios ni de bandas. La usan tanto
 * el estudiante (piezas del examen) como el profesor (`notas.ts`), y ninguno
 * de los dos necesita arrastrarse el módulo del otro para usar cinco líneas.
 */
export function enLista(cosas: string[], conjuncion: "y" | "ni" = "y"): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  return `${cosas.slice(0, -1).join(", ")} ${conjuncion} ${cosas[cosas.length - 1]}`;
}
