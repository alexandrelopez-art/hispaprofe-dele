import { prisma } from "@/lib/db";
import type { Prueba } from "@/lib/generated/prisma";

/** Las cuatro pruebas del DELE: en modo LIBRE se abren todas de golpe, no hay intento que mirar. */
const TODAS_LAS_PRUEBAS: readonly Prueba[] = ["CE", "CO", "EE", "EO"];

/**
 * Los ficheros que esta persona puede abrir ahora mismo: los de las tareas de
 * las pruebas que tiene abiertas, y nada más.
 *
 * Por qué no basta con mirar `Pieza.ficheroId`, que es lo que hacía el candado
 * hasta la aceptación de la 3c: la pista de audio SÍ es una pieza con su
 * fichero, pero las fotos de las opciones no cuelgan de ninguna pieza — son
 * identificadores dentro del `datos` de la actividad (`imagenes`, clave →
 * fichero), porque así las guarda el taller. Preguntando solo por piezas, la
 * pista se veía y las fotos daban 404: en la auditiva 1, donde la respuesta ES
 * la foto, la tarea no se podía hacer.
 *
 * Las hojas escaneadas del examen quedan fuera por construcción, que es lo que
 * importa: se llega a los ficheros por las TAREAS, y una `PaginaDeExamen`
 * cuelga del examen, no de una tarea. Ninguna rama de aquí puede alcanzarla.
 */
export async function ficherosDeLasPruebasAbiertas(personaId: string): Promise<Set<string>> {
  const asignaciones = await prisma.asignacion.findMany({
    where: { personaId, examen: { estado: "PUBLICADO" } },
    select: { examenId: true, modo: true, intentos: { select: { prueba: true } } },
  });

  const abiertas = asignaciones.flatMap((a) =>
    a.modo === "LIBRE"
      ? TODAS_LAS_PRUEBAS.map((prueba) => ({ examenId: a.examenId, prueba }))
      : a.intentos.map((i) => ({ examenId: a.examenId, prueba: i.prueba })),
  );
  if (abiertas.length === 0) return new Set();

  // Una sola consulta para todas las pruebas abiertas de esta persona, y solo
  // de sus tareas: el `datos` que trae es el de esas tareas, no el del examen.
  const piezas = await prisma.pieza.findMany({
    where: { tarea: { OR: abiertas.map((a) => ({ examenId: a.examenId, prueba: a.prueba })) } },
    select: { ficheroId: true, actividad: { select: { datos: true } } },
  });

  const ficheros = new Set<string>();
  for (const pieza of piezas) {
    // La pista de audio: es la propia pieza.
    if (pieza.ficheroId) ficheros.add(pieza.ficheroId);
    // Las fotos: viven dentro de la actividad, por clave.
    const datos = pieza.actividad?.datos;
    if (datos && typeof datos === "object" && !Array.isArray(datos)) {
      const imagenes = (datos as Record<string, unknown>).imagenes;
      if (imagenes && typeof imagenes === "object" && !Array.isArray(imagenes)) {
        for (const id of Object.values(imagenes as Record<string, unknown>)) {
          if (typeof id === "string" && id !== "") ficheros.add(id);
        }
      }
    }
  }
  return ficheros;
}
