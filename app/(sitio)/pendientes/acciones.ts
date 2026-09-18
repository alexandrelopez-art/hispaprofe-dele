"use server";

import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { guardarCorreccion } from "@/lib/examen/corregir";

const FORMA_MALA = "Esos datos no tienen la forma esperada.";
/** Unas 300 palabras: de sobra para el comentario de una tarea, y un tope
 *  para que una llamada a mano a esta dirección no intente meter cualquier
 *  cosa en esa columna. */
const TOPE_DEL_COMENTARIO = 2000;

/**
 * `guardarCorreccion` da por hecho que `tareas` trae exactamente la forma del
 * tipo — hace `.length` y recorre `bandas` sin comprobar nada antes—, y esta
 * es una dirección pública: cualquiera que la conozca puede llamarla con lo
 * que quiera, no solo con lo que manda `CorregirEscrita`. Sin esta guarda, un
 * `bandas: null` a mano no vuelve con un error con su mensaje: revienta con
 * un 500 crudo.
 */
function tareasConFormaValida(
  tareas: unknown,
): tareas is { tarea: number; bandas: number[]; comentario: string }[] {
  if (!Array.isArray(tareas)) return false;
  return tareas.every((t) => {
    if (typeof t !== "object" || t === null) return false;
    const { tarea, bandas, comentario } = t as Record<string, unknown>;
    return (
      typeof tarea === "number" &&
      Array.isArray(bandas) && bandas.every((b) => typeof b === "number") &&
      typeof comentario === "string" && comentario.length <= TOPE_DEL_COMENTARIO
    );
  });
}

/**
 * Firmar una corrección. `exigirProfesor`, no `exigirPersona`: es la única
 * puerta por la que se pone una nota, y una acción de servidor es una
 * dirección pública. Tampoco recibe quién corrige: sale de la sesión.
 */
export async function guardarCorreccionAccion(
  intentoId: string,
  tareas: { tarea: number; bandas: number[]; comentario: string }[],
): Promise<{ error?: string }> {
  const profesor = await exigirProfesor();
  if (!tareasConFormaValida(tareas)) return { error: FORMA_MALA };
  const r = await guardarCorreccion(intentoId, tareas, profesor.id, new Date());
  revalidatePath("/pendientes");
  revalidatePath(`/pendientes/${intentoId}`);
  // La cabecera cuenta Pendientes en el layout, que no se vuelve a pintar al
  // navegar: sin esto, el número seguiría diciendo lo de antes de firmar.
  revalidatePath("/", "layout");
  return r;
}
