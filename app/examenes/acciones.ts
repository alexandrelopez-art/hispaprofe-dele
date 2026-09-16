"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { archivarExamen, crearExamen, guardarTarea, publicarExamen, recuperarExamen, retirarExamen } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas, sustituirPaginas } from "@/lib/taller/paginas";
import { elegirCuadernillo, guardarCuadernillo } from "@/lib/taller/cuadernillos";
import type { EstadoDeTarea } from "@/lib/taller/estado";
import type { ModoDeExamen } from "@/lib/generated/prisma";
import { rellenarTarea, type ResultadoDeRelleno } from "@/lib/taller/ia/rellenar";
import { asignarExamen, quitarAsignacion } from "@/lib/examen/asignar";
import { listaDeNombres } from "@/lib/examen/nombres";
import { mandarPorSmtp } from "@/lib/correo/transporte";
import { direccionDelSitio } from "@/lib/puerta/sitio";

// Las pantallas ya exigen al profesor, pero una acción de servidor es una
// dirección pública: cada una vuelve a comprobarlo, la primera línea.

const pantallaDelExamen = (examenId: string) => `/examenes/${examenId}`;

export async function crearExamenAccion(formulario: FormData): Promise<void> {
  await exigirProfesor();
  const r = await crearExamen({
    titulo: String(formulario.get("titulo") ?? ""),
    nivel: String(formulario.get("nivel") ?? ""),
  });
  if ("error" in r) redirect(`/examenes?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(r.id));
}

export async function registrarPaginasAccion(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await registrarPaginas(examenId, ficheroIds);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function borrarPaginasAccion(examenId: string): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await borrarPaginas(examenId);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function sustituirPaginasAccion(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await sustituirPaginas(examenId, ficheroIds);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function etiquetarPaginaAccion(examenId: string, paginaId: string, etiquetas: string[]): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await etiquetarPagina(examenId, paginaId, etiquetas);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function guardarCuadernilloAccion(examenId: string, titulo: string, trozos: unknown): Promise<{ error?: string }> {
  await exigirProfesor();
  const guardado = await guardarCuadernillo({ titulo, trozos });
  if ("error" in guardado) return { error: guardado.error };
  const elegido = await elegirCuadernillo(examenId, guardado.id, null);
  revalidatePath(pantallaDelExamen(examenId));
  return elegido;
}

export async function elegirCuadernilloAccion(examenId: string, formulario: FormData): Promise<void> {
  await exigirProfesor();
  const cuadernilloId = String(formulario.get("cuadernilloId") ?? "") || null;
  const numeroEscrito = String(formulario.get("numero") ?? "");
  const numero = numeroEscrito === "" ? null : Number(numeroEscrito);
  const r =
    numero !== null && !Number.isInteger(numero)
      ? { error: "Ese número de examen no vale." }
      : await elegirCuadernillo(examenId, cuadernilloId, cuadernilloId ? numero : null);
  revalidatePath(pantallaDelExamen(examenId));
  if (r.error) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(examenId));
}

export async function guardarTareaAccion(
  examenId: string,
  prueba: string,
  numero: number,
  formulario: unknown,
): Promise<{ estado: EstadoDeTarea } | { error: string }> {
  await exigirProfesor();
  if (!esPrueba(prueba) || !Number.isInteger(numero)) return { error: "Esa tarea no existe." };
  const r = await guardarTarea(examenId, prueba, numero, formulario);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

/** Devuelve el formulario para la pantalla. No guarda la tarea, así que no hay nada que revalidar. */
export async function rellenarTareaConIAAccion(examenId: string, prueba: string, numero: number): Promise<ResultadoDeRelleno> {
  await exigirProfesor();
  if (!esPrueba(prueba) || !Number.isInteger(numero)) return { error: "Esa tarea no existe." };
  return rellenarTarea(examenId, prueba, numero);
}

async function volverAlExamen(examenId: string, r: { error?: string }): Promise<never> {
  revalidatePath(pantallaDelExamen(examenId));
  if (r.error) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(examenId));
}

export async function publicarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await publicarExamen(examenId));
}

export async function retirarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await retirarExamen(examenId));
}

export async function archivarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await archivarExamen(examenId));
}

export async function recuperarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await recuperarExamen(examenId));
}

export async function asignarExamenAccion(examenId: string, formulario: FormData): Promise<void> {
  const profesor = await exigirProfesor();
  const personaIds = formulario.getAll("estudiante").map(String);
  const dia = String(formulario.get("dia") ?? "");
  // Del formulario solo se acepta el «LIBRE» exacto; cualquier otra cosa
  // (nada marcado, un valor inventado) es completo. Es una decisión sin
  // mensaje de error a propósito: el modo no es un dato que el profesor
  // escriba, son dos casillas, y lo prudente cuando no se entiende lo que
  // llega es el examen de verdad, no la práctica que abre los cuatro ficheros.
  const modo: ModoDeExamen = formulario.get("modo") === "LIBRE" ? "LIBRE" : "COMPLETO";
  const base = direccionDelSitio(await headers());
  const r = await asignarExamen(examenId, personaIds, dia, modo, profesor.id, mandarPorSmtp, base, new Date());
  revalidatePath(pantallaDelExamen(examenId));
  if ("error" in r) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  const aviso =
    r.sinAviso.length === 0
      ? `Asignado a ${r.asignados}.`
      : `Asignado a ${r.asignados}. No salió el aviso a ${listaDeNombres(r.sinAviso)}: díselo tú.`;
  redirect(`${pantallaDelExamen(examenId)}?aviso=${encodeURIComponent(aviso)}`);
}

export async function quitarAsignacionAccion(examenId: string, personaId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await quitarAsignacion(examenId, personaId));
}
