"use server";

import { revalidatePath } from "next/cache";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import type { Prueba } from "@/lib/generated/prisma";
import { PRUEBAS_QUE_SE_HACEN } from "@/lib/examen/paraHacer";
import {
  corregirEnLibre,
  empezarPrueba,
  entregarPrueba,
  guardarEscrito,
  guardarRespuesta,
  marcarTrozo,
  salirDeLaEscrita,
  volverALaEscrita,
} from "@/lib/examen/hacer";
import type { Nota } from "@/lib/examen/motor";

// Una acción de servidor es una dirección pública: quien la conozca la llama
// sin pasar por la pantalla, sin haber entrado nunca por el examen de nadie.
// Por eso NINGUNA de las seis de aquí abajo recibe un identificador de
// persona: la persona sale siempre de exigirPersona() (la sesión), nunca de
// un argumento. Si tomara un personaId, cualquiera que conociera esta
// dirección podría contestar el examen de otro estudiante llamándola a mano.

const NO_SE_HACE = "Esa prueba todavía no se puede hacer.";

const pantallaDeLaPrueba = (examenId: string, prueba: Prueba) => `/examen/${examenId}/${prueba}`;

// esPrueba comprueba las cuatro pruebas del DELE; PRUEBAS_QUE_SE_HACEN, cuáles
// de esas cuatro tiene ya pantalla (hoy CE, CO y EE: la oral llega con la 3e).
// Aunque el tipo de
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

/**
 * Sin `porTiempo`: quién entregó por reloj lo decide el servidor
 * (`entregarPrueba`), no quien llama. Con el argumento puesto, cualquiera que
 * conociera esta dirección podía dejarle al profesor un «Entregada por tiempo»
 * en una prueba entregada con toda la calma.
 */
export async function entregarPruebaAccion(examenId: string, prueba: Prueba): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  const r = await entregarPrueba(examenId, prueba, persona.id, new Date());
  revalidatePath(pantallaDeLaPrueba(examenId, prueba));
  return r;
}

/** El modo libre no guarda nada (lib/examen/hacer.ts): no hay nada que revalidar. */
export async function corregirEnLibreAccion(examenId: string, prueba: Prueba, respuestas: Record<string, string>): Promise<Nota | { error: string }> {
  const persona = await exigirPersona();
  if (!pruebaValida(prueba)) return { error: NO_SE_HACE };
  return corregirEnLibre(examenId, prueba, persona.id, respuestas);
}

/**
 * El borrador. NO revalida la pantalla: se llama cada pocos segundos mientras
 * el estudiante escribe, y revalidar aquí sería volver a pintar el servidor
 * doscientas veces por redacción para nada — el texto que se ve ya es el del
 * navegador. La pantalla se revalida al entregar, que es cuando cambia de cara.
 *
 * Sin `prueba` en la firma: el borrador es de la escrita y de ninguna otra.
 */
export async function guardarEscritoAccion(
  examenId: string,
  tarea: number,
  texto: string,
  opcion: number | null,
): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  return guardarEscrito(examenId, persona.id, tarea, texto, opcion, new Date());
}

/**
 * Se ha ido de la pantalla a media redacción. Abre la ausencia: la cierra la
 * vuelta, por el navegador o por la siguiente carga de la página.
 *
 * Sin `prueba` en la firma, como el borrador: esto es de la escrita y de ninguna
 * otra prueba. NO revalida: se llama justo cuando la pantalla se está dejando
 * atrás y no hay nada que repintar; revalidar aquí solo añadiría trabajo al
 * viaje que menos tiempo tiene para llegar.
 */
export async function salirDeLaEscritaAccion(examenId: string, tarea: number): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  return salirDeLaEscrita(examenId, persona.id, tarea, new Date());
}

/**
 * Ha vuelto. Cierra la ausencia y no devuelve nada que enseñar: el estudiante no
 * ha perdido nada, así que no hay cartel ninguno. Tampoco revalida — lo que
 * cambia es el registro, y el registro no sale hacia su pantalla: lo lee el
 * profesor al corregir.
 */
export async function volverALaEscritaAccion(examenId: string): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  return volverALaEscrita(examenId, persona.id, new Date());
}
