"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { crearExamen, guardarTarea } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas, sustituirPaginas } from "@/lib/taller/paginas";
import { elegirCuadernillo, guardarCuadernillo } from "@/lib/taller/cuadernillos";
import type { EstadoDeTarea } from "@/lib/taller/estado";

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

export async function borrarPaginasAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await borrarPaginas(examenId);
  revalidatePath(pantallaDelExamen(examenId));
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
