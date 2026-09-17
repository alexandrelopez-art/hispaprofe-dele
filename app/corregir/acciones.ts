"use server";

import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { guardarCorreccion } from "@/lib/examen/corregir";

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
  const r = await guardarCorreccion(intentoId, tareas, profesor.id, new Date());
  revalidatePath("/corregir");
  revalidatePath(`/corregir/${intentoId}`);
  return r;
}
