import { prisma } from "@/lib/db";
import type { Prueba } from "@/lib/generated/prisma";
import { minutosDePrueba } from "@/lib/dele/estructura";
import { notaDePrueba, seAcaboElTiempo, type Nota } from "./motor";

// Los mensajes de error, literales (spec §9). Otras pantallas y otras tareas
// los comparan por texto: cambiar una coma aquí las rompe.
const NO_SE_HACE = "Esa prueba todavía no se puede hacer.";
const NO_ES_TUYO = "Este examen no es tuyo.";
const NO_DISPONIBLE = "Este examen ya no está disponible.";
const YA_ENTREGADA = "Esta prueba ya está entregada.";
const SE_ACABO = "Se acabó el tiempo.";
// El sexto mensaje: una server action es una dirección pública, cualquiera que
// la conozca puede llamarla. Una excepción ahí es un 500 sin explicación para
// una pestaña vieja; esto es un error como los otros cinco, no un fallo.
const NO_EMPEZADA = "Todavía no has empezado esta prueba.";
// El séptimo: el candado de `corregirEnLibre`. Sin él, esa función es un
// oráculo de la clave para cualquier asignación en modo COMPLETO.
const NO_LIBRE = "Este examen no es de práctica libre.";

type IntentoAbierto = {
  id: string;
  empezadaEn: Date;
  entregadaEn: Date | null;
  respuestas: { numero: number; letra: string }[];
};
type AsignacionAbierta = { id: string };

/**
 * La clave de una prueba entera: la unión de las `Clave` de todas las tareas
 * de esa prueba, tal como se congelaron al guardarlas (Entrega 1). Nunca del
 * cuadernillo: el cuadernillo puede cambiar y no tiene por qué arrastrar la
 * nota de un examen ya publicado. Privada: no hay otra salida para la
 * respuesta correcta que esta función.
 */
async function claveDeLaPrueba(examenId: string, prueba: Prueba): Promise<Record<string, string>> {
  const tareas = await prisma.tarea.findMany({
    where: { examenId, prueba },
    select: { piezas: { select: { actividad: { select: { clave: { select: { respuestas: true } } } } } } },
  });
  const clave: Record<string, string> = {};
  for (const tarea of tareas) {
    for (const pieza of tarea.piezas) {
      const respuestas = pieza.actividad?.clave?.respuestas;
      if (respuestas && typeof respuestas === "object" && !Array.isArray(respuestas)) {
        Object.assign(clave, respuestas as Record<string, string>);
      }
    }
  }
  return clave;
}

/**
 * Calcula la nota con la clave y las respuestas que ya se cargaron (quien
 * llama las trae: no hay una segunda vuelta a la base a buscarlas), y la
 * escribe junto con `entregadaEn` en la misma llamada — es la única vez que
 * se calcula. Después de esto, nada vuelve a mirar la `Clave` para este
 * intento.
 *
 * La escritura lleva `entregadaEn: null` en el propio `where`: es un
 * `updateMany` condicional, no un `update` a ciegas. Dos entregas a la vez
 * (un doble clic, o una entrega que corre con el cierre automático de la
 * guarda) pueden ver las dos `entregadaEn` en null, pero solo la primera en
 * llegar encuentra la fila y escribe; la segunda no toca nada.
 */
async function congelarNota(
  examenId: string,
  prueba: Prueba,
  intentoId: string,
  respuestas: readonly { numero: number; letra: string }[],
  ahora: Date,
  porTiempo: boolean,
): Promise<void> {
  const clave = await claveDeLaPrueba(examenId, prueba);
  const respuestasPorNumero = Object.fromEntries(respuestas.map((r) => [String(r.numero), r.letra]));
  const nota = notaDePrueba(clave, respuestasPorNumero);
  await prisma.intento.updateMany({
    where: { id: intentoId, entregadaEn: null },
    data: {
      entregadaEn: ahora,
      porTiempo,
      aciertos: nota.aciertos,
      total: nota.total,
      fallos: nota.fallos.map((f) => f.numero),
    },
  });
}

/**
 * La única guarda de las cuatro escrituras que tocan un intento
 * (`corregirEnLibre` no pasa por aquí: no hay intento en modo libre, y hace
 * su propia comprobación). Comprueba, EN ESTE ORDEN: que la prueba es CE o
 * CO, que hay asignación, que el examen está publicado, que el intento no
 * está entregado y que no se acabó el tiempo. Si se acabó, cierra la prueba
 * (la entrega con `porTiempo`) antes de devolver el error: el error y el
 * cierre son la misma noticia.
 *
 * `exigirEmpezada: false` (solo lo usa `empezarPrueba`) deja pasar sin
 * intento: es la única función a la que le toca crearlo. Las demás piden
 * `true`; si llegan aquí sin un intento ya empezado, devuelven el error —
 * NUNCA lo crean solas. Una server action es una dirección pública: cualquiera
 * que la conozca puede llamarla, y crear el intento aquí dejaría a un
 * estudiante con una pestaña vieja empezar la prueba sin el aviso y sin saber
 * que el reloj ya corre.
 */
async function abrirLaPrueba(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  ahora: Date,
  opciones: { exigirEmpezada: boolean },
): Promise<{ asignacion: AsignacionAbierta; intento: IntentoAbierto | null } | { error: string }> {
  if (prueba !== "CE" && prueba !== "CO") return { error: NO_SE_HACE };

  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    include: {
      examen: { select: { nivel: true, estado: true } },
      intentos: {
        where: { prueba },
        select: {
          id: true,
          empezadaEn: true,
          entregadaEn: true,
          respuestas: { select: { numero: true, letra: true } },
        },
      },
    },
  });
  if (!asignacion) return { error: NO_ES_TUYO };
  if (asignacion.examen.estado !== "PUBLICADO") return { error: NO_DISPONIBLE };

  const intento = asignacion.intentos[0] ?? null;
  if (!intento && opciones.exigirEmpezada) return { error: NO_EMPEZADA };
  if (intento?.entregadaEn) return { error: YA_ENTREGADA };

  if (intento) {
    const minutos = minutosDePrueba(asignacion.examen.nivel, prueba);
    if (seAcaboElTiempo(intento.empezadaEn, minutos, ahora)) {
      await congelarNota(examenId, prueba, intento.id, intento.respuestas, ahora, true);
      return { error: SE_ACABO };
    }
  }

  return { asignacion: { id: asignacion.id }, intento };
}

/**
 * Fija el reloj. Un `upsert` con `update: {}`: si el intento ya existía, no
 * se toca nada (ni `empezadaEn` ni nada más) — es lo que impide que pulsar
 * «Empezar» dos veces regale minutos.
 */
export async function empezarPrueba(examenId: string, prueba: Prueba, personaId: string, ahora: Date): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada: false });
  if ("error" in abierta) return abierta;

  await prisma.intento.upsert({
    where: { asignacionId_prueba: { asignacionId: abierta.asignacion.id, prueba } },
    create: { asignacionId: abierta.asignacion.id, prueba, empezadaEn: ahora },
    update: {},
  });
  return {};
}

/** Una letra por pregunta. Cambiar de opinión no crea una segunda fila. */
export async function guardarRespuesta(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  numero: number,
  letra: string,
  ahora: Date,
): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  await prisma.respuestaDeIntento.upsert({
    where: { intentoId_numero: { intentoId: abierta.intento!.id, numero } },
    create: { intentoId: abierta.intento!.id, numero, letra },
    update: { letra },
  });
  return {};
}

/** Un trozo oído se apunta una vez. Pedirlo otra vez no lo borra ni lo reescribe. */
export async function marcarTrozo(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  tarea: number,
  trozo: number,
  ahora: Date,
): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  await prisma.trozoOido.upsert({
    where: { intentoId_tarea_trozo: { intentoId: abierta.intento!.id, tarea, trozo } },
    create: { intentoId: abierta.intento!.id, tarea, trozo },
    update: {},
  });
  return {};
}

/** El botón «Entregar», o el cierre automático desde `abrirLaPrueba` con `porTiempo: true`. */
export async function entregarPrueba(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  ahora: Date,
  porTiempo: boolean,
): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  await congelarNota(examenId, prueba, abierta.intento!.id, abierta.intento!.respuestas, ahora, porTiempo);
  return {};
}

/**
 * Para las pantallas que solo leen: cierra, con `porTiempo`, los intentos de
 * ese ámbito a los que ya se les acabó el tiempo. Idempotente — solo mira los
 * que siguen sin `entregadaEn`, así que la segunda llamada no encuentra nada
 * que cerrar. Pasa las respuestas que ya cargó aquí a `congelarNota`: en la
 * pantalla del profesor esto corre sobre una clase entera, y no hay que
 * volver a la base por cada intento — ni arriesgarse a que uno borrado entre
 * medias (cascada de la asignación) tire abajo una pantalla que solo lee.
 */
export async function cerrarLasQueSePasaron(donde: { personaId: string } | { examenId: string }, ahora: Date): Promise<void> {
  const intentos = await prisma.intento.findMany({
    where: { entregadaEn: null, asignacion: donde },
    select: {
      id: true,
      prueba: true,
      empezadaEn: true,
      respuestas: { select: { numero: true, letra: true } },
      asignacion: { select: { examenId: true, examen: { select: { nivel: true } } } },
    },
  });
  for (const intento of intentos) {
    const minutos = minutosDePrueba(intento.asignacion.examen.nivel, intento.prueba);
    if (seAcaboElTiempo(intento.empezadaEn, minutos, ahora)) {
      await congelarNota(intento.asignacion.examenId, intento.prueba, intento.id, intento.respuestas, ahora, true);
    }
  }
}

/**
 * El modo libre no guarda intento: se corrige al vuelo y no queda rastro. No
 * escribe nada en la base, y lo que devuelve nunca lleva la letra buena —
 * `fallos` lleva lo que marcó el estudiante, no lo que tenía que marcar.
 */
export async function corregirEnLibre(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  respuestas: Record<string, string>,
): Promise<Nota | { error: string }> {
  if (prueba !== "CE" && prueba !== "CO") return { error: NO_SE_HACE };

  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    include: { examen: { select: { estado: true } } },
  });
  if (!asignacion) return { error: NO_ES_TUYO };
  if (asignacion.examen.estado !== "PUBLICADO") return { error: NO_DISPONIBLE };
  if (asignacion.modo !== "LIBRE") return { error: NO_LIBRE };

  const clave = await claveDeLaPrueba(examenId, prueba);
  return notaDePrueba(clave, respuestas);
}
