"use server";

import { revalidatePath } from "next/cache";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import type { Prueba } from "@/lib/generated/prisma";
import { PRUEBAS_QUE_SE_HACEN } from "@/lib/examen/paraHacer";
import { corregirEnLibre, empezarPrueba, entregarPrueba, guardarRespuesta, marcarTrozo } from "@/lib/examen/hacer";
import type { Nota } from "@/lib/examen/motor";

// Una acción de servidor es una dirección pública: quien la conozca la llama
// sin pasar por la pantalla, sin haber entrado nunca por el examen de nadie.
// Por eso NINGUNA de las cinco de aquí abajo recibe un identificador de
// persona: la persona sale siempre de exigirPersona() (la sesión), nunca de
// un argumento. Si tomara un personaId, cualquiera que conociera esta
// dirección podría contestar el examen de otro estudiante llamándola a mano.

const NO_SE_HACE = "Esa prueba todavía no se puede hacer.";

const pantallaDeLaPrueba = (examenId: string, prueba: Prueba) => `/examen/${examenId}/${prueba}`;

// esPrueba comprueba las cuatro pruebas del DELE; PRUEBAS_QUE_SE_HACEN, cuáles
// de esas cuatro tiene ya pantalla (hoy, solo CE y CO). Aunque el tipo de
// `prueba` ya es `Prueba` en la firma, eso es solo TypeScript: una acción de
// servidor es una dirección pública y a runtime puede llegar cualquier texto.
function pruebaValida(prueba: string): prueba is Prueba {
  return esPrueba(prueba) && PRUEBAS_QUE_SE_HACEN.includes(prueba);
}

export async function empezarPruebaAccion(examenId: string, prueba: Prueba): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  const r = await empezarPrueba(examenId, prueba, persona.id, new Date());
  revalidatePath(pantallaDeLaPrueba(examenId, prueba));
  return r;
}

export async function guardarRespuestaAccion(examenId: string, prueba: Prueba, numero: number, letra: string): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  const r = await guardarRespuesta(examenId, prueba, persona.id, numero, letra, new Date());
  revalidatePath(pantallaDeLaPrueba(examenId, prueba));
  return r;
}

export async function marcarTrozoAccion(examenId: string, prueba: Prueba, tarea: number, trozo: number): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  const r = await marcarTrozo(examenId, prueba, persona.id, tarea, trozo, new Date());
  revalidatePath(pantallaDeLaPrueba(examenId, prueba));
  return r;
}

export async function entregarPruebaAccion(examenId: string, prueba: Prueba, porTiempo: boolean): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  const r = await entregarPrueba(examenId, prueba, persona.id, new Date(), porTiempo);
  revalidatePath(pantallaDeLaPrueba(examenId, prueba));
  return r;
}

/** El modo libre no guarda nada (lib/examen/hacer.ts): no hay nada que revalidar. */
export async function corregirEnLibreAccion(examenId: string, prueba: Prueba, respuestas: Record<string, string>): Promise<Nota | { error: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  return corregirEnLibre(examenId, prueba, persona.id, respuestas);
}
