import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { enlaceDeLectura } from "@/lib/ficheros/vercel";
import { puedeVerFichero } from "@/lib/ficheros/permisos";

/**
 * Sirve un fichero del almacén de Vercel con un 307 a un enlace de lectura
 * de vida corta. Los ficheros de Drive no se sirven por aquí: 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const persona = await personaDeLaPeticion();
  if (!persona) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }

  const { id } = await params;
  const fichero = await prisma.fichero.findUnique({ where: { id } });
  // El mismo 404, con el mismo cuerpo, para «no existe» y para «no es tuyo»: un
  // 403 le confirmaría a quien prueba identificadores que ese existe.
  if (!fichero || fichero.almacen !== "VERCEL" || !puedeVerFichero(persona, fichero)) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const url = await enlaceDeLectura(fichero.ruta, new Date());
  const respuesta = NextResponse.redirect(url, 307);
  // El enlace es de vida muy corta y personal: ninguna caché debe guardarlo.
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
