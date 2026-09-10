import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { abrirSesionDeSubida } from "@/lib/ficheros/drive";

const cuerpo = z.object({
  nombre: z.string().min(1).max(255),
  tipoMime: z.string().min(1),
});

/** Solo audio o vídeo: es una grabación del estudiante, nada de páginas ni de audios del examen. */
function tipoPermitido(tipoMime: string): boolean {
  return tipoMime.startsWith("audio/") || tipoMime.startsWith("video/");
}

/**
 * Abre una sesión de subida directa a la unidad compartida de Drive. Esta es
 * una ruta de DATOS, no una pantalla: si no hay sesión responde 401; nunca
 * redirige, porque quien llama espera JSON.
 *
 * Aquí quien sube es el ESTUDIANTE que graba, no el profesor: cualquier
 * persona con sesión puede pedir una dirección. Lo único que se devuelve es
 * esa dirección (`url`): el estudiante nunca recibe el identificador de la
 * carpeta ni ninguna credencial, ni siquiera dentro de la propia dirección
 * de sesión (esa forma la decide Google, no nosotros).
 */
export async function POST(request: NextRequest) {
  const persona = await personaDeLaPeticion();
  if (!persona) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }

  const cuerpoRecibido = await request.json().catch(() => null);
  const datos = cuerpo.safeParse(cuerpoRecibido);
  if (!datos.success) {
    return NextResponse.json({ error: "Datos de la petición incompletos o inválidos." }, { status: 400 });
  }
  const { nombre, tipoMime } = datos.data;

  if (!tipoPermitido(tipoMime)) {
    return NextResponse.json({ error: "Solo se admiten grabaciones de audio o vídeo." }, { status: 400 });
  }

  const url = await abrirSesionDeSubida({ nombre, tipoMime });
  return NextResponse.json({ url });
}
