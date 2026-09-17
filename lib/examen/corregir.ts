import { prisma } from "@/lib/db";
import type { Nivel } from "@/lib/generated/prisma";
import { BANDA_MAXIMA, CRITERIOS_EE, puntosDeEscrita } from "@/lib/dele/estructura";
import { sumaDeBandas } from "./motor";
import { formularioDePiezas } from "@/lib/taller/piezas";
import type { Formulario } from "@/lib/taller/formas";
import { diasEntre } from "@/lib/tiempo/madrid";

// Literales, como los de lib/examen/hacer.ts: las pruebas los comparan por texto.
const NOTA_MALA = "Esa nota no vale.";
const TAREA_MALA = "Esa tarea no existe.";
const SIN_ENTREGAR = "Esa prueba todavía no está entregada.";

export type EnLaCola = {
  intentoId: string;
  examenId: string;
  titulo: string;
  persona: { id: string; nombre: string };
  entregadaEn: Date;
  porTiempo: boolean;
  diasEsperando: number;
};

/**
 * Las escritas que esperan: entregadas y sin firmar. Lo más viejo arriba, que
 * es el orden en que hay que corregir.
 *
 * `corregidaEn: null` es lo que decide, NO que las bandas estén vacías: el
 * profesor puede haber guardado a medias sin firmar, y eso sigue esperando.
 *
 * No cierra las que se pasaron de hora: esta función solo lee. Las cierra quien
 * tiene ámbito para hacerlo (el Inicio del estudiante y la lista del examen),
 * como se decidió en la 3c.
 */
export async function escritosPorCorregir(ahora: Date): Promise<EnLaCola[]> {
  const intentos = await prisma.intento.findMany({
    where: { prueba: "EE", entregadaEn: { not: null }, corregidaEn: null },
    orderBy: { entregadaEn: "asc" },
    select: {
      id: true,
      entregadaEn: true,
      porTiempo: true,
      asignacion: {
        select: {
          examenId: true,
          examen: { select: { titulo: true } },
          persona: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  return intentos.map((i) => ({
    intentoId: i.id,
    examenId: i.asignacion.examenId,
    titulo: i.asignacion.examen.titulo,
    persona: i.asignacion.persona,
    entregadaEn: i.entregadaEn!,
    porTiempo: i.porTiempo,
    diasEsperando: diasEntre(i.entregadaEn!, ahora),
  }));
}

export type TareaParaCorregir = {
  numero: number;
  formulario: Formulario;
  opcion: number | null;
  texto: string;
  palabras: number;
  bandas: number[];
  comentario: string;
};

export type ParaCorregir = {
  intentoId: string;
  examen: { id: string; titulo: string; nivel: Nivel };
  persona: { id: string; nombre: string };
  entregadaEn: Date;
  porTiempo: boolean;
  corregidaEn: Date | null;
  puntos: number;
  tareas: TareaParaCorregir[];
  /** El siguiente de la cola, para «Guardar y seguir». null si no queda nadie. */
  siguiente: string | null;
};

/**
 * Todo lo que hace falta para corregir una: el enunciado de cada tarea (sin él,
 * el profesor lee un texto sin saber a qué contestaba), la opción elegida en la
 * tarea 2, lo escrito, y lo que ya hubiera puesto si vuelve a entrar.
 *
 * Las tareas salen de las del EXAMEN, no de los escritos: quien entregó en
 * blanco no tiene fila de escrito, y a ese también hay que poder corregirlo.
 */
export async function escritoParaCorregir(intentoId: string, ahora: Date): Promise<ParaCorregir | null> {
  const intento = await prisma.intento.findUnique({
    where: { id: intentoId },
    select: {
      id: true, prueba: true, entregadaEn: true, porTiempo: true, corregidaEn: true,
      escritos: { select: { tarea: true, opcion: true, texto: true, palabras: true, bandas: true, comentario: true } },
      asignacion: {
        select: {
          persona: { select: { id: true, nombre: true } },
          examen: {
            select: {
              id: true, titulo: true, nivel: true,
              tareas: {
                where: { prueba: "EE" },
                orderBy: { numero: "asc" },
                select: {
                  numero: true,
                  piezas: { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!intento || intento.prueba !== "EE" || !intento.entregadaEn) return null;

  const examen = intento.asignacion.examen;
  const tareas = examen.tareas.flatMap((t): TareaParaCorregir[] => {
    const formulario = formularioDePiezas(t.piezas);
    if (!formulario) return [];
    const escrito = intento.escritos.find((e) => e.tarea === t.numero);
    return [{
      numero: t.numero,
      formulario,
      opcion: escrito?.opcion ?? null,
      texto: escrito?.texto ?? "",
      palabras: escrito?.palabras ?? 0,
      bandas: escrito?.bandas ?? [],
      comentario: escrito?.comentario ?? "",
    }];
  });

  const cola = await escritosPorCorregir(ahora);
  const siguiente = cola.find((c) => c.intentoId !== intentoId)?.intentoId ?? null;

  return {
    intentoId: intento.id,
    examen: { id: examen.id, titulo: examen.titulo, nivel: examen.nivel },
    persona: intento.asignacion.persona,
    entregadaEn: intento.entregadaEn,
    porTiempo: intento.porTiempo,
    corregidaEn: intento.corregidaEn,
    puntos: puntosDeEscrita(examen.nivel),
    tareas,
    siguiente,
  };
}

/**
 * Firmar la corrección. Valida TODO antes de escribir NADA: si una banda de la
 * tarea 2 no vale, la 1 tampoco se guarda. Una corrección a medias sería peor
 * que ninguna, porque la suma congelada saldría de un trozo.
 *
 * `upsert` y no `update`: quien entregó en blanco no tiene fila de escrito.
 *
 * La suma se hace sobre TODOS los escritos del intento después de aplicar lo
 * que llega, no solo sobre lo que llega: corregir solo la tarea 2 no puede
 * borrar la nota de la 1.
 */
export async function guardarCorreccion(
  intentoId: string,
  tareas: { tarea: number; bandas: number[]; comentario: string }[],
  profesorId: string,
  ahora: Date,
): Promise<{ error?: string }> {
  const intento = await prisma.intento.findUnique({
    where: { id: intentoId },
    select: {
      id: true, prueba: true, entregadaEn: true,
      escritos: { select: { tarea: true, bandas: true } },
      asignacion: {
        select: {
          examenId: true,
          examen: { select: { nivel: true, tareas: { where: { prueba: "EE" }, select: { numero: true } } } },
        },
      },
    },
  });
  if (!intento || intento.prueba !== "EE") return { error: TAREA_MALA };
  if (!intento.entregadaEn) return { error: SIN_ENTREGAR };

  const numerosDelExamen = new Set(intento.asignacion.examen.tareas.map((t) => t.numero));
  for (const t of tareas) {
    if (!numerosDelExamen.has(t.tarea)) return { error: TAREA_MALA };
    if (t.bandas.length !== CRITERIOS_EE.length) return { error: NOTA_MALA };
    if (t.bandas.some((b) => !Number.isInteger(b) || b < 0 || b > BANDA_MAXIMA)) return { error: NOTA_MALA };
  }

  // Cómo quedan TODOS los escritos después de esta corrección.
  const despues = new Map(intento.escritos.map((e) => [e.tarea, e.bandas as number[]]));
  for (const t of tareas) despues.set(t.tarea, t.bandas);
  const total = puntosDeEscrita(intento.asignacion.examen.nivel);
  const aciertos = sumaDeBandas([...despues.values()].map((bandas) => ({ bandas })));

  await prisma.$transaction([
    ...tareas.map((t) =>
      prisma.escritoDeIntento.upsert({
        where: { intentoId_tarea: { intentoId, tarea: t.tarea } },
        create: { intentoId, tarea: t.tarea, texto: "", palabras: 0, bandas: t.bandas, comentario: t.comentario },
        update: { bandas: t.bandas, comentario: t.comentario },
      }),
    ),
    prisma.intento.update({
      where: { id: intentoId },
      data: { aciertos, total, corregidaEn: ahora, corregidaPorId: profesorId },
    }),
  ]);
  return {};
}
