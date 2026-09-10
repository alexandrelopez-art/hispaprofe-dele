"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { pedirEnlace } from "@/lib/puerta/entrada";
import { mandarPorSmtp } from "@/lib/correo/transporte";
import { direccionDelSitio } from "@/lib/puerta/sitio";

export async function pedirEntrada(formulario: FormData): Promise<void> {
  const correo = String(formulario.get("correo") ?? "");
  const cabeceras = await headers();
  const base = direccionDelSitio(cabeceras);
  await pedirEnlace(correo, new Date(), mandarPorSmtp, base);
  redirect("/entrar/enviado");
}
