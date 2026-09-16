import { prisma } from "@/lib/db";
import type { Mandar } from "@/lib/correo/mensaje";
import { mensajeDeAsignacion } from "@/lib/correo/mensaje";
import type { ModoDeExamen, Nivel, Prueba } from "@/lib/generated/prisma";
import { NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { bloquearExamen } from "@/lib/taller/publicado";
import { diasDeRetraso, estaFueraDePlazo, fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";
import { estadoDePrueba, textoDelEstado, type EstadoDePrueba } from "./motor";
import { PRUEBAS_QUE_SE_HACEN } from "./paraHacer";

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
 *
 * `modo` es el mismo para toda la tanda: es lo que marcó el profesor en la
 * caja «Quién lo hace». Sin él, `LIBRE` no lo escribía nadie en toda la
 * aplicación y la práctica libre —pantalla, corrección al vuelo y candado de
 * los ficheros— no se podía alcanzar.
 */
export async function asignarExamen(
  examenId: string,
  personaIds: string[],
  dia: string,
  modo: ModoDeExamen,
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
      // El `modo` va también en el `update`: volver a asignar es la única
      // forma que tiene el profesor de cambiar de completo a libre o al revés,
      // y si el update no lo tocara, el segundo intento no haría nada y no lo
      // diría. Ojo con lo que eso significa cuando ya hay intento: pasar a
      // libre no borra la nota (el intento sigue en la base), pero deja de
      // enseñarla, porque en libre no hay estado que enseñar.
      await tx.asignacion.upsert({
        where: { examenId_personaId: { examenId, personaId: persona.id } },
        create: { examenId, personaId: persona.id, fechaTope, modo, asignadaPorId: profesorId },
        update: { fechaTope, modo, asignadaPorId: profesorId },
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

/**
 * La asignación cae en cascada sobre el intento (`onDelete: Cascade`): quitar
 * a alguien de la lista sin mirar si ya empezó le borraría la nota entera.
 * Por eso se comprueba antes de borrar, no después.
 */
export async function quitarAsignacion(examenId: string, personaId: string): Promise<{ error?: string }> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    include: { persona: { select: { nombre: true } }, intentos: { select: { id: true }, take: 1 } },
  });
  if (!asignacion) return { error: "Esa asignación ya no existe." };
  if (asignacion.intentos.length > 0) {
    return { error: `${asignacion.persona.nombre} ya ha empezado este examen: no se le puede quitar.` };
  }

  await prisma.asignacion.delete({ where: { id: asignacion.id } });
  return {};
}

export type EstadoDeUnaPrueba = { prueba: Prueba; estado: EstadoDePrueba; texto: string };

type IntentoParaEstado = { prueba: Prueba; entregadaEn: Date | null; aciertos: number | null; total: number | null; porTiempo: boolean };

// Los campos que las dos consultas de abajo piden de `intentos`: los mismos
// que necesita estadoDePrueba, más `prueba` para emparejarlos con
// PRUEBAS_QUE_SE_HACEN. Nunca las respuestas ni la clave: eso no sale de
// pruebaParaHacer.
const CAMPOS_DEL_INTENTO = { prueba: true, entregadaEn: true, aciertos: true, total: true, porTiempo: true } as const;

/**
 * El estado de las dos pruebas que hoy tienen pantalla, para una asignación.
 * En modo LIBRE no hay intento nunca (corregirEnLibre corrige al vuelo y no
 * deja rastro): un estado ahí sería mentira, así que se devuelve vacío.
 */
function pruebasDeLaAsignacion(modo: ModoDeExamen, intentos: readonly IntentoParaEstado[]): EstadoDeUnaPrueba[] {
  if (modo === "LIBRE") return [];
  return PRUEBAS_QUE_SE_HACEN.map((prueba) => {
    const estado = estadoDePrueba(intentos.find((i) => i.prueba === prueba) ?? null);
    return { prueba, estado, texto: textoDelEstado(estado) };
  });
}

export async function asignacionesDelExamen(
  examenId: string,
): Promise<{ personaId: string; nombre: string; fechaTope: Date; pruebas: EstadoDeUnaPrueba[] }[]> {
  const filas = await prisma.asignacion.findMany({
    where: { examenId },
    include: { persona: { select: { nombre: true } }, intentos: { select: CAMPOS_DEL_INTENTO } },
    orderBy: { persona: { nombre: "asc" } },
  });
  return filas.map((f) => ({
    personaId: f.personaId,
    nombre: f.persona.nombre,
    fechaTope: f.fechaTope,
    // El retraso se añade AQUÍ, no dentro de pruebasDeLaAsignacion: es lo que
    // ve el profesor (la razón de ser de un tope blando), y no lo que se le
    // enseña al propio estudiante en asignacionesDe.
    pruebas: pruebasDeLaAsignacion(f.modo, f.intentos).map((p) => {
      const entrega = f.intentos.find((i) => i.prueba === p.prueba)?.entregadaEn;
      if (!entrega || !estaFueraDePlazo(f.fechaTope, entrega)) return p;
      const dias = diasDeRetraso(f.fechaTope, entrega);
      return { ...p, texto: `${p.texto} — ${dias} ${dias === 1 ? "día" : "días"} tarde` };
    }),
  }));
}

export type AsignacionDelEstudiante = {
  examenId: string;
  titulo: string;
  nivel: Nivel;
  modo: ModoDeExamen;
  fechaTope: Date;
  pruebas: EstadoDeUnaPrueba[];
};

/**
 * Lo único que sale hacia el navegador del estudiante. Se construye campo a
 * campo, como actividadParaElEstudiante: si mañana la asignación gana un campo
 * con la nota o con las respuestas, no se cuela solo por existir. Ahora sí
 * lleva la nota (en `pruebas`), y por eso importa más, no menos: el retraso
 * que ve el profesor en asignacionesDelExamen NO se cuela aquí.
 */
export async function asignacionesDe(personaId: string): Promise<AsignacionDelEstudiante[]> {
  const filas = await prisma.asignacion.findMany({
    where: { personaId },
    include: { examen: { select: { id: true, titulo: true, nivel: true } }, intentos: { select: CAMPOS_DEL_INTENTO } },
    orderBy: { fechaTope: "asc" },
  });
  return filas.map((f) => ({
    examenId: f.examen.id,
    titulo: f.examen.titulo,
    nivel: f.examen.nivel,
    modo: f.modo,
    fechaTope: f.fechaTope,
    pruebas: pruebasDeLaAsignacion(f.modo, f.intentos),
  }));
}
