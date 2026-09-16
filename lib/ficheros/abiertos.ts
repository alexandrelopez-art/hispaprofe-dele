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
 * Las hojas escaneadas quedan fuera por la FORMA de la consulta: aquí se llega
 * a los ficheros por las TAREAS, y una `PaginaDeExamen` cuelga del examen, no
 * de una tarea. Pero la garantía no es de la tabla, y conviene decirlo entero,
 * porque el fallo de arriba lo causó justamente un comentario demasiado seguro:
 * un mismo `Fichero` PUEDE llevar a la vez las relaciones `piezas` y `paginas`.
 * Una hoja se colaría si alguna vez la misma fila de `Fichero` fuera a la vez
 * página y foto de una opción. Hoy no puede: cada subida acuña una ruta nueva
 * con azar (`app/api/ficheros/permiso`) y `Fichero` es único por (almacén,
 * ruta), así que subir dos veces el mismo JPEG da dos filas distintas.
 */
export async function ficherosDeLasPruebasAbiertas(personaId: string): Promise<Set<string>> {
  const asignaciones = await prisma.asignacion.findMany({
    // `estado: PUBLICADO` es un cinturón: hoy no puede haber una asignación viva
    // sobre un examen que no lo esté (retirar se niega con gente asignada, y
    // archivar solo se llega desde construcción). Si algún día se afloja esa
    // guarda, esto falla del lado seguro: el estudiante vería 404 en sus
    // propias fotos en vez de ver material de un examen retirado.
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
    where: {
      tarea: { OR: abiertas.map((a) => ({ examenId: a.examenId, prueba: a.prueba })) },
      // La consigna y los textos sueltos son piezas TEXTO: nunca llevan fichero
      // ni fotos, y son la mayoría de las filas. Fuera.
      tipo: { in: ["AUDIO", "ACTIVIDAD"] },
    },
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
