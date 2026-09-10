import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import {
  CARPETA_DE_MATERIAL,
  permisoDeSubida,
  puedeSubirMaterial,
  rutaDelFichero,
  tipoPermitido,
} from "@/lib/ficheros/vercel";

const MAX_BYTES = 50 * 1024 * 1024;

const cuerpo = z.object({
  nombre: z.string().min(1).max(255),
  tipoMime: z.string().min(1),
  bytes: z.number().int().positive(),
});

/**
 * Pide permiso para subir un fichero. Esta es una ruta de DATOS, no una
 * pantalla: si no hay sesión responde 401, si la hay pero no es el profesor
 * responde 403; nunca redirige, porque quien llama espera JSON.
 */
export async function POST(request: NextRequest) {
  const persona = await personaDeLaPeticion();
  if (!persona) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }
  if (!puedeSubirMaterial(persona.papel)) {
    return NextResponse.json({ error: "Solo el profesor puede subir material." }, { status: 403 });
  }

  const cuerpoRecibido = await request.json().catch(() => null);
  const datos = cuerpo.safeParse(cuerpoRecibido);
  if (!datos.success) {
    return NextResponse.json({ error: "Datos de la petición incompletos o inválidos." }, { status: 400 });
  }
  const { nombre, tipoMime, bytes } = datos.data;

  // Aquí bytes y tipoMime son lo que DICE el navegador: solo sirven para
  // decidir el permiso. Lo que se guarda en la base sale del almacén, en
  // /api/ficheros/confirmar.
  if (!tipoPermitido(tipoMime)) {
    return NextResponse.json({ error: "Solo se admiten imágenes o audio." }, { status: 400 });
  }
  if (bytes > MAX_BYTES) {
    return NextResponse.json({ error: "El fichero pesa más de 50 MB." }, { status: 400 });
  }

  const ruta = rutaDelFichero(CARPETA_DE_MATERIAL, nombre, randomBytes(6).toString("hex"));
  const { url, validoHasta } = await permisoDeSubida(ruta, [tipoMime], bytes, new Date());

  return NextResponse.json({ url, ruta, validoHasta });
}
