import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { enlaceDeLectura, MINUTOS_DE_LECTURA, MINUTOS_DE_LECTURA_DE_AUDIO } from "@/lib/ficheros/vercel";
import { puedeVerFichero } from "@/lib/ficheros/permisos";
import { ficherosDeLasPruebasAbiertas } from "@/lib/ficheros/abiertos";

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
  if (!fichero || fichero.almacen !== "VERCEL") {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  // Al profesor no se le exige nada más: ve todo por la primera rama del
  // candado, y pedirle esta consulta sería trabajo tirado en el camino que más
  // se usa. Al estudiante, una sola llamada resuelve cualquier fichero que pida.
  const abiertos = persona.papel === "PROFESOR" ? new Set<string>() : await ficherosDeLasPruebasAbiertas(persona.id);

  // El mismo 404, con el mismo cuerpo, para «no existe» y para «no es tuyo»: un
  // 403 le confirmaría a quien prueba identificadores que ese existe.
  if (!puedeVerFichero(persona, fichero, abiertos)) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  // Una pista de once minutos que el navegador vuelve a pedir a mitad de la
  // reproducción se encontraría el enlace de cinco minutos ya muerto, y la
  // cinta se quedaría muda a media frase: el audio pide una hora.
  const minutos = fichero.tipoMime.startsWith("audio/") ? MINUTOS_DE_LECTURA_DE_AUDIO : MINUTOS_DE_LECTURA;
  const url = await enlaceDeLectura(fichero.ruta, new Date(), minutos);
  const respuesta = NextResponse.redirect(url, 307);
  // El enlace es de vida muy corta y personal: ninguna caché debe guardarlo.
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
