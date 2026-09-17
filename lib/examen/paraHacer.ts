import { prisma } from "@/lib/db";
import type { ModoDeExamen, Nivel, Prueba } from "@/lib/generated/prisma";
import { minutosConReloj, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioDePiezas } from "@/lib/taller/piezas";
import type { Formulario } from "@/lib/taller/formas";
import { estadoDePrueba, segundosQueQuedan, type EstadoDePrueba } from "./motor";

export type TareaParaHacer = {
  numero: number;
  regla: ReglaTarea;
  formulario: Formulario;
  trozos: number;
  oidos: number[];
};

/** Lo poco que el navegador necesita de un escrito. La corrección va aparte y
 *  solo cuando está FIRMADA: ver `pruebaParaHacer`. */
export type EscritoParaHacer = {
  tarea: number;
  opcion: number | null;
  texto: string;
  palabras: number;
  correccion: { bandas: number[]; comentario: string } | null;
};

export type PruebaParaHacer = {
  examen: { id: string; titulo: string; nivel: Nivel };
  prueba: Prueba;
  modo: ModoDeExamen;
  fechaTope: Date;
  minutos: number | null;
  tareas: TareaParaHacer[];
  estado: EstadoDePrueba;
  segundosQueQuedan: number | null;
  respuestas: Record<string, string>;
  fallos: number[];
  escritos: EscritoParaHacer[];
  /** Cuándo la mandó el estudiante. null = todavía no la ha entregado. La
   *  escrita pasa días en ESPERANDO, y sin esta fecha su pantalla no puede
   *  decirle que su redacción llegó (ni cuándo). */
  entregadaEn: Date | null;
  /** Cuándo firmó el profesor. null = sin corregir (o no es la escrita). */
  corregidaEn: Date | null;
  /** Cómo van las DEMÁS pruebas de este examen: la pantalla de resultado dice qué queda por hacer. */
  otras: { prueba: Prueba; estado: EstadoDePrueba }[];
};

/** Las tres pruebas que el estudiante puede hacer hoy. La oral llega con la 3e. */
export const PRUEBAS_QUE_SE_HACEN: readonly Prueba[] = ["CE", "CO", "EE"];

/**
 * Las que en práctica libre dejan rastro: solo la escrita. Es la decisión del
 * profesor (spec §9): en libre la escrita crea intento igual, se entrega de
 * verdad y entra en la cola de corrección, porque una redacción sin corregir no
 * sirve de nada. La lectura y la auditiva, en cambio, se corrigen al vuelo
 * (`corregirEnLibre`) y no escriben nada en la base: de esas no hay estado que
 * contar, y contarlo sería mentir.
 */
export const PRUEBAS_CON_RASTRO_EN_LIBRE: readonly Prueba[] = ["EE"];

/**
 * La única puerta por la que una prueba sale hacia el navegador del estudiante.
 * Se construye campo a campo, como `actividadParaElEstudiante`: la consulta ni
 * siquiera selecciona la tabla `Clave`, y aunque mañana alguien la incluyera,
 * este objeto no tiene dónde meterla.
 */
export async function pruebaParaHacer(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  ahora: Date,
): Promise<PruebaParaHacer | null> {
  if (!PRUEBAS_QUE_SE_HACEN.includes(prueba)) return null;

  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    include: {
      examen: {
        select: {
          id: true,
          titulo: true,
          nivel: true,
          estado: true,
          tareas: {
            where: { prueba },
            orderBy: { numero: "asc" },
            select: {
              numero: true,
              // Sin `clave`: la respuesta correcta no sale de su tabla.
              piezas: { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } },
            },
          },
        },
      },
      intentos: { include: { respuestas: true, trozosOidos: true, escritos: true } },
    },
  });
  if (!asignacion || asignacion.examen.estado !== "PUBLICADO") return null;

  const intento = asignacion.intentos.find((i) => i.prueba === prueba) ?? null;
  const oidosDe = (numero: number) =>
    (intento?.trozosOidos ?? []).filter((t) => t.tarea === numero).map((t) => t.trozo).sort((a, b) => a - b);

  const tareas = asignacion.examen.tareas.flatMap((t): TareaParaHacer[] => {
    const regla = reglaDe(asignacion.examen.nivel, prueba, t.numero);
    const formulario = formularioDePiezas(t.piezas);
    if (!regla || !formulario) return [];
    return [{ numero: t.numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: oidosDe(t.numero) }];
  });

  // Con el modo dentro: en libre no hay reloj, y entonces `minutos` y
  // `segundosQueQuedan` salen null hacia el navegador. Antes viajaban los del
  // nivel aunque la pantalla no los pintara, y eso obligaba a cada pantalla a
  // volver a mirar `modo` por su cuenta para no mentir.
  const minutos = minutosConReloj(asignacion.modo, asignacion.examen.nivel, prueba);

  // Campo a campo, como las respuestas: la fila de EscritoDeIntento lleva
  // `bandas` y `comentario` dentro, y mientras no esté FIRMADA no pueden salir
  // de aquí. Lo que decide es `corregidaEn`, no que las bandas estén puestas:
  // el profesor puede haber guardado y no haber firmado.
  const firmada = intento?.corregidaEn ?? null;
  const escritos: EscritoParaHacer[] = (intento?.escritos ?? [])
    .sort((a, b) => a.tarea - b.tarea)
    .map((e) => ({
      tarea: e.tarea,
      opcion: e.opcion,
      texto: e.texto,
      palabras: e.palabras,
      correccion: firmada ? { bandas: e.bandas, comentario: e.comentario } : null,
    }));

  return {
    examen: { id: asignacion.examen.id, titulo: asignacion.examen.titulo, nivel: asignacion.examen.nivel },
    prueba,
    modo: asignacion.modo,
    fechaTope: asignacion.fechaTope,
    minutos,
    tareas,
    estado: estadoDePrueba(intento),
    segundosQueQuedan: intento && !intento.entregadaEn ? segundosQueQuedan(intento.empezadaEn, minutos, ahora) : null,
    respuestas: Object.fromEntries((intento?.respuestas ?? []).map((r) => [String(r.numero), r.letra])),
    fallos: intento?.fallos ?? [],
    escritos,
    entregadaEn: intento?.entregadaEn ?? null,
    corregidaEn: firmada,
    otras: PRUEBAS_QUE_SE_HACEN.filter((otra) => otra !== prueba).map((otra) => ({
      prueba: otra,
      estado: estadoDePrueba(asignacion.intentos.find((i) => i.prueba === otra) ?? null),
    })),
  };
}
