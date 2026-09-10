"use server";

import { redirect } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { darDeAlta } from "@/lib/puerta/personas";
import type { Papel } from "@/lib/generated/prisma";

const PAPELES_VALIDOS: readonly Papel[] = ["PROFESOR", "ESTUDIANTE"];

function esPapel(valor: FormDataEntryValue | null): valor is Papel {
  return typeof valor === "string" && (PAPELES_VALIDOS as readonly string[]).includes(valor);
}

export async function crearPersona(formulario: FormData): Promise<void> {
  // La pantalla ya exige que quien mira sea el profesor, pero una acción de
  // servidor es una dirección pública: quien la conozca puede llamarla sin
  // pasar por la pantalla. Por eso se vuelve a comprobar aquí.
  const quien = await exigirProfesor();

  const papel = formulario.get("papel");
  if (!esPapel(papel)) {
    redirect(`/personas?error=${encodeURIComponent("Ese papel no existe.")}`);
  }

  const resultado = await darDeAlta(quien, {
    correo: String(formulario.get("correo") ?? ""),
    nombre: String(formulario.get("nombre") ?? ""),
    papel,
  });

  if ("error" in resultado) {
    redirect(`/personas?error=${encodeURIComponent(resultado.error)}`);
  }
  redirect("/personas");
}
