import { prisma } from "@/lib/db";
import type { Mandar } from "@/lib/correo/mensaje";
import { mensajeDeAsignacion } from "@/lib/correo/mensaje";
import type { ModoDeExamen, Nivel } from "@/lib/generated/prisma";
import { NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { bloquearExamen } from "@/lib/taller/publicado";
import { fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

export type ResultadoDeAsignar = { asignados: number; sinAviso: string[] } | { error: string };

/**
 * Lo que sale de la transacción. Con el tipo puesto a mano, en vez de dejar que
 * TypeScript lo infiera de los `return`, `"error" in guardado` narrows de
 * verdad: inferido, TS añade `error?: undefined` al otro lado y la propia
 * presencia de la clave (aunque valga undefined) rompe el narrowing.
 */
type ResultadoDeLaTransaccion =
  | { error: string }
  | { examen: { titulo: string; nivel: Nivel }; personas: { id: string; nombre: string; correo: string }[] };

// Sin `correo`: esto es lo que pinta <QuienLoHace>, un componente de cliente
// que solo declara `{ id, nombre }`. asignarExamen tiene su propio select
// dentro de la transacción (con correo, para mandar el aviso), así que quitarlo
// de aquí no le afecta.
export function estudiantesParaAsignar(): Promise<{ id: string; nombre: string }[]> {
  return prisma.persona.findMany({
    where: { papel: "ESTUDIANTE", activa: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

/**
 * Guarda las asignaciones y luego avisa. El correo va FUERA de la transacción a
 * propósito: si el buzón de un menor rebota, los otros once tienen que quedarse
 * con su examen igual. Los que no reciben aviso vuelven por nombre para que el
 * profesor se lo diga a mano.
 */
export async function asignarExamen(
  examenId: string,
  personaIds: string[],
  dia: string,
  profesorId: string,
  mandar: Mandar,
  base: string,
  ahora: Date,
): Promise<ResultadoDeAsignar> {
  if (personaIds.length === 0) return { error: "Marca al menos un estudiante." };
  const fechaTope = finDelDiaEnMadrid(dia);
  if (!fechaTope) return { error: "Falta la fecha, o no es una fecha." };
  if (fechaTope.getTime() < ahora.getTime()) return { error: "Esa fecha ya pasó." };

  const guardado = await prisma.$transaction(async (tx): Promise<ResultadoDeLaTransaccion> => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado !== "PUBLICADO") return { error: "Solo se asigna un examen publicado." };

    const examen = await tx.examen.findUniqueOrThrow({ where: { id: examenId }, select: { titulo: true, nivel: true } });
    const personas = await tx.persona.findMany({
      where: { id: { in: personaIds }, papel: "ESTUDIANTE", activa: true },
      select: { id: true, nombre: true, correo: true },
    });
    // O valen todos o no vale ninguno: media tanda asignada es peor que ninguna,
    // porque el profesor no sabe a quién le faltó.
    if (personas.length !== personaIds.length) return { error: "Esa lista de estudiantes no vale." };

    for (const persona of personas) {
      await tx.asignacion.upsert({
        where: { examenId_personaId: { examenId, personaId: persona.id } },
        create: { examenId, personaId: persona.id, fechaTope, asignadaPorId: profesorId },
        update: { fechaTope, asignadaPorId: profesorId },
      });
    }
    return { examen, personas };
  }, { timeout: 15_000 }); // doce upserts secuenciales, y Neon a veces despierta en frío: el timeout por defecto (5 s) se queda corto.
  if ("error" in guardado) return guardado;

  const sinAviso: string[] = [];
  for (const persona of guardado.personas) {
    try {
      await mandar(
        mensajeDeAsignacion(persona.correo, {
          nombre: persona.nombre,
          titulo: guardado.examen.titulo,
          nivel: NOMBRE_DE_NIVEL[guardado.examen.nivel],
          fechaEnPalabras: fechaEnPalabras(fechaTope),
          url: base,
        }),
      );
    } catch {
      sinAviso.push(persona.nombre);
    }
  }
  return { asignados: guardado.personas.length, sinAviso };
}

export async function quitarAsignacion(examenId: string, personaId: string): Promise<{ error?: string }> {
  const r = await prisma.asignacion.deleteMany({ where: { examenId, personaId } });
  return r.count === 1 ? {} : { error: "Esa asignación ya no existe." };
}

export async function asignacionesDelExamen(examenId: string): Promise<{ personaId: string; nombre: string; fechaTope: Date }[]> {
  const filas = await prisma.asignacion.findMany({
    where: { examenId },
    include: { persona: { select: { nombre: true } } },
    orderBy: { persona: { nombre: "asc" } },
  });
  return filas.map((f) => ({ personaId: f.personaId, nombre: f.persona.nombre, fechaTope: f.fechaTope }));
}

export type AsignacionDelEstudiante = {
  examenId: string;
  titulo: string;
  nivel: Nivel;
  modo: ModoDeExamen;
  fechaTope: Date;
};

/**
 * Lo único que sale hacia el navegador del estudiante. Se construye campo a
 * campo, como actividadParaElEstudiante: si mañana la asignación gana un campo
 * con la nota o con las respuestas, no se cuela solo por existir.
 */
export async function asignacionesDe(personaId: string): Promise<AsignacionDelEstudiante[]> {
  const filas = await prisma.asignacion.findMany({
    where: { personaId },
    include: { examen: { select: { id: true, titulo: true, nivel: true } } },
    orderBy: { fechaTope: "asc" },
  });
  return filas.map((f) => ({
    examenId: f.examen.id,
    titulo: f.examen.titulo,
    nivel: f.examen.nivel,
    modo: f.modo,
    fechaTope: f.fechaTope,
  }));
}
