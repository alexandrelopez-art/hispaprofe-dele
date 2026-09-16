import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { enlaceDeLectura, MINUTOS_DE_LECTURA, MINUTOS_DE_LECTURA_DE_AUDIO } from "@/lib/ficheros/vercel";
import { puedeVerFichero, type PruebaAbierta } from "@/lib/ficheros/permisos";
import type { Prueba } from "@/lib/generated/prisma";

/** Las cuatro pruebas del DELE: en modo LIBRE se abren todas de golpe, no hay intento que mirar. */
const TODAS_LAS_PRUEBAS: readonly Prueba[] = ["CE", "CO", "EE", "EO"];

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
  const fichero = await prisma.fichero.findUnique({
    where: { id },
    include: { piezas: { select: { tarea: { select: { examenId: true, prueba: true } } } } },
  });
  if (!fichero || fichero.almacen !== "VERCEL") {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  // Al profesor no se le exige ninguna prueba abierta (ve todo, primera rama
  // de puedeVerFichero): pedirle esta consulta de más sería trabajo tirado en
  // el camino que más usa. Al estudiante, UNA sola consulta a sus propias
  // asignaciones basta para las piezas de todos los ficheros que pida, nunca
  // una por pieza. Modo LIBRE abre las cuatro pruebas de su examen (no hay
  // intento: la práctica libre no guarda nada); modo COMPLETO abre solo las
  // pruebas con un intento ya empezado, entregado incluido, porque la
  // pantalla de resultados enseña las fotos de lo que falló.
  //
  // La pregunta obvia sobre la rama de LIBRE —«¿y un examen retirado cuya
  // asignación en libre sigue abriendo los cuatro ficheros?»— no se puede dar
  // hoy, y conviene saber por qué antes de tocar nada: mientras hay una
  // asignación viva el examen NO se puede retirar (`retirarExamen` se niega y
  // dice los nombres), archivar solo se llega desde construcción, y asignar
  // exige que esté publicado. O sea: publicado con gente dentro, o sin gente
  // dentro y entonces sin asignaciones que mirar. Quien algún día afloje la
  // guarda de retirar es quien abre ese agujero, y este es el sitio donde va a
  // estar de pie cuando lo haga: aquí habría que mirar también el estado del
  // examen, no solo la asignación.
  const abiertas: PruebaAbierta[] =
    persona.papel === "PROFESOR"
      ? []
      : (
          await prisma.asignacion.findMany({
            where: { personaId: persona.id },
            select: { examenId: true, modo: true, intentos: { select: { prueba: true } } },
          })
        ).flatMap((asignacion) =>
          asignacion.modo === "LIBRE"
            ? TODAS_LAS_PRUEBAS.map((prueba) => ({ examenId: asignacion.examenId, prueba }))
            : asignacion.intentos.map((intento) => ({ examenId: asignacion.examenId, prueba: intento.prueba })),
        );

  // El mismo 404, con el mismo cuerpo, para «no existe» y para «no es tuyo»: un
  // 403 le confirmaría a quien prueba identificadores que ese existe.
  if (!puedeVerFichero(persona, fichero, abiertas)) {
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
