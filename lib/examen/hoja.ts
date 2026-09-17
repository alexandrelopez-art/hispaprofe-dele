import { prisma } from "@/lib/db";
import type { Prueba } from "@/lib/generated/prisma";
import { claveDeLaPrueba } from "./hacer";

export type FilaDeHoja = { numero: number; marcada: string | null; correcta: string };
export type HojaDeRespuestas = {
  persona: { nombre: string };
  titulo: string;
  prueba: Prueba;
  aciertos: number | null;
  total: number | null;
  filas: FilaDeHoja[];
};

/**
 * La ficha del profesor: qué marcó esta persona en cada pregunta y qué era.
 *
 * Es la ÚNICA pantalla fuera del taller que lee la tabla `Clave` (comparte esa
 * lectura, `claveDeLaPrueba`, con `lib/examen/hacer.ts`, que la usa para
 * calificar), y por eso su página exige PROFESOR. Tres cosas que no son
 * obvias:
 *
 * - Devuelve null si la prueba no está entregada. Mientras se hace, la clave no
 *   sale de su tabla ni para el profesor: una pestaña abierta en su portátil no
 *   puede ser la vía por la que se filtre.
 * - Las filas salen de recorrer la CLAVE, no las respuestas. Una pregunta sin
 *   contestar tiene que aparecer, y aparece con `marcada: null`; si se
 *   recorrieran las respuestas, las que dejó en blanco desaparecerían.
 * - No recalcula la nota: enseña la congelada en el intento. Si el profesor
 *   corrigiera hoy una tarea del examen, el 19 de 25 de aquel día sigue siendo
 *   el de aquel día.
 */
export async function hojaDeRespuestas(
  examenId: string,
  personaId: string,
  prueba: Prueba,
): Promise<HojaDeRespuestas | null> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    select: {
      persona: { select: { nombre: true } },
      examen: { select: { titulo: true } },
      intentos: {
        where: { prueba },
        select: { entregadaEn: true, aciertos: true, total: true, respuestas: { select: { numero: true, letra: true } } },
      },
    },
  });
  const intento = asignacion?.intentos[0];
  if (!asignacion || !intento || !intento.entregadaEn) return null;

  const clave = await claveDeLaPrueba(examenId, prueba);

  const marcadas = new Map(intento.respuestas.map((r) => [String(r.numero), r.letra]));
  const filas = Object.entries(clave)
    .map(([numero, correcta]) => ({
      numero: Number(numero),
      marcada: (marcadas.get(numero) ?? "").trim() === "" ? null : marcadas.get(numero)!,
      correcta,
    }))
    .sort((a, b) => a.numero - b.numero);

  return {
    persona: asignacion.persona,
    titulo: asignacion.examen.titulo,
    prueba,
    aciertos: intento.aciertos,
    total: intento.total,
    filas,
  };
}
