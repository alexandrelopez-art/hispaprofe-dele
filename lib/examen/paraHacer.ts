import { prisma } from "@/lib/db";
import type { ModoDeExamen, Nivel, Prueba } from "@/lib/generated/prisma";
import { minutosDePrueba, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
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
};

/** Las únicas dos pruebas que el estudiante puede hacer hoy. La 3d y la 3e traerán las otras. */
export const PRUEBAS_QUE_SE_HACEN: readonly Prueba[] = ["CE", "CO"];

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
      intentos: { where: { prueba }, include: { respuestas: true, trozosOidos: true } },
    },
  });
  if (!asignacion || asignacion.examen.estado !== "PUBLICADO") return null;

  const intento = asignacion.intentos[0] ?? null;
  const oidosDe = (numero: number) =>
    (intento?.trozosOidos ?? []).filter((t) => t.tarea === numero).map((t) => t.trozo).sort((a, b) => a - b);

  const tareas = asignacion.examen.tareas.flatMap((t): TareaParaHacer[] => {
    const regla = reglaDe(asignacion.examen.nivel, prueba, t.numero);
    const formulario = formularioDePiezas(t.piezas);
    if (!regla || !formulario) return [];
    return [{ numero: t.numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: oidosDe(t.numero) }];
  });

  const minutos = minutosDePrueba(asignacion.examen.nivel, prueba);
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
  };
}
