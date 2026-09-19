import type { TareaParaHacer } from "@/lib/examen/paraHacer";
import { itemsDelFormulario } from "@/lib/taller/estado";
import { enLista } from "@/lib/examen/en-lista";

/**
 * Lo que queda sin contestar, tarea a tarea, en frases que se leen tras
 * «Ojo:». Una cadena vacía NO cuenta como contestada (el servidor guarda ""
 * al borrar). Los números salen de `itemsDelFormulario`, la misma fuente que
 * corrige: si se contaran de otra forma, la pregunta diría que falta una que
 * la nota da por contestada.
 */
export function sinResponderPorTarea(tareas: TareaParaHacer[], marcadas: Record<string, string>): string[] {
  const falta: string[] = [];
  for (const t of tareas) {
    const numeros = itemsDelFormulario(t.formulario);
    const sin = numeros.filter((n) => (marcadas[String(n)] ?? "").trim() === "");
    if (sin.length === 0) continue;
    if (sin.length === numeros.length) falta.push(`no has contestado nada en la tarea ${t.numero}`);
    else falta.push(`en la tarea ${t.numero} no has contestado ${enLista(sin.map((n) => `la ${n}`), "ni")}`);
  }
  return falta;
}
