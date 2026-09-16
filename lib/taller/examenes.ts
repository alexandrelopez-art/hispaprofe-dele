import type { EstadoExamen, Nivel, Prisma, Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import {
  ESTRUCTURAS,
  PRUEBAS,
  etiquetaDeTarea,
  nivelesConReglas,
  reglaDe,
  type ReglaTarea,
} from "@/lib/dele/estructura";
import { motivosParaPublicar, type TareaConEstado } from "@/lib/examen/publicar";
import { esquemaDelFormulario, formularioVacio, type Formulario } from "./formas";
import { gastoDelExamen } from "./ia/registro";
import { formularioDePiezas, piezasDelFormulario, type PiezaLeida } from "./piezas";
import { claveDelFormulario, estadoDeTarea, itemsDelFormulario, type EstadoDeTarea } from "./estado";
import { listaDeNombres } from "@/lib/examen/nombres";
import { ExamenNoEditable, MENSAJE_ARCHIVADO, MENSAJE_PUBLICADO, bloquearExamen, exigirEditable } from "./publicado";
import { resumenDeSoluciones, type RespuestasDeUnaPrueba, type ResumenDeExamen, type Soluciones } from "./soluciones";

export async function crearExamen(datos: { titulo: string; nivel: string }): Promise<{ id: string } | { error: string }> {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "El examen necesita un título." };
  if (titulo.length > 200) return { error: "El título es demasiado largo." };
  const nivel = nivelesConReglas().find((n) => n === datos.nivel);
  if (!nivel) return { error: "Ese nivel todavía no tiene sus números en el taller." };
  const estructura = ESTRUCTURAS[nivel]!;
  const examen = await prisma.examen.create({
    data: {
      titulo,
      nivel,
      tareas: { create: PRUEBAS.flatMap((prueba) => estructura[prueba].map((r) => ({ prueba, numero: r.numero }))) },
    },
  });
  return { id: examen.id };
}

export function listarExamenes() {
  return prisma.examen.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, nivel: true, estado: true },
  });
}

/** Las respuestas del cuadernillo para una prueba de este examen, o null si no hay de dónde sacarlas. */
export function respuestasDe(
  examen: { numeroEnCuadernillo: number | null; cuadernillo: { soluciones: unknown } | null },
  prueba: Prueba,
): RespuestasDeUnaPrueba | null {
  if (prueba !== "CE" && prueba !== "CO") return null;
  if (!examen.cuadernillo || examen.numeroEnCuadernillo === null) return null;
  const soluciones = examen.cuadernillo.soluciones as Soluciones;
  return soluciones[String(examen.numeroEnCuadernillo)]?.[prueba] ?? null;
}

const CON_PIEZAS = { piezas: { include: { actividad: { include: { clave: true } } } } } as const;

type TareaConPiezas = {
  piezas: (PiezaLeida & { actividad: { datos: unknown; clave: { respuestas: unknown } | null } | null })[];
};

/** El formulario guardado y su clave. `claveGuardada` es {} si se guardó sin cuadernillo, null si nunca se guardó. */
function leerTarea(tarea: TareaConPiezas): { formulario: Formulario | null; claveGuardada: Record<string, string> | null } {
  const formulario = formularioDePiezas(tarea.piezas);
  if (!formulario) return { formulario: null, claveGuardada: null };
  const clave = tarea.piezas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.clave?.respuestas;
  return { formulario, claveGuardada: (clave as Record<string, string> | undefined) ?? {} };
}

type ExamenConTareas = {
  nivel: Nivel;
  numeroEnCuadernillo: number | null;
  cuadernillo: { soluciones: unknown } | null;
  tareas: (TareaConPiezas & { prueba: Prueba; numero: number })[];
};

/** Cada tarea del examen con su estado y sus ítems, en el orden de las pruebas. */
function tareasConEstado(examen: ExamenConTareas): (TareaConEstado & { estado: EstadoDeTarea })[] {
  return PRUEBAS.flatMap((prueba) =>
    examen.tareas
      .filter((t) => t.prueba === prueba)
      .sort((a, b) => a.numero - b.numero)
      .flatMap((t) => {
        const regla = reglaDe(examen.nivel, t.prueba, t.numero);
        if (!regla) return [];
        const { formulario, claveGuardada } = leerTarea(t);
        const estado = estadoDeTarea(regla, formulario, respuestasDe(examen, t.prueba), claveGuardada);
        return [{ prueba: t.prueba, numero: t.numero, estado, completa: estado.estado === "COMPLETA", items: formulario ? itemsDelFormulario(formulario).length : 0 }];
      }),
  );
}

export type ExamenDelTaller = {
  id: string;
  titulo: string;
  nivel: Nivel;
  numeroEnCuadernillo: number | null;
  cuadernillo: { id: string; titulo: string; resumen: ResumenDeExamen[] } | null;
  paginas: { id: string; ficheroId: string; orden: number; etiquetas: string[] }[];
  tareas: { prueba: Prueba; numero: number; estado: EstadoDeTarea }[];
  estado: EstadoExamen;
  motivosParaPublicar: string[];
  /** Lo que ha costado la IA en este examen (estimación). */
  gasto: { llamadas: number; milesimas: number };
};

export async function examenParaElTaller(id: string): Promise<ExamenDelTaller | null> {
  const examen = await prisma.examen.findUnique({
    where: { id },
    include: { cuadernillo: true, paginas: { orderBy: { orden: "asc" } }, tareas: { include: CON_PIEZAS } },
  });
  if (!examen) return null;
  const estructura = ESTRUCTURAS[examen.nivel];

  const conEstado = tareasConEstado(examen);
  const tareas = conEstado.map(({ prueba, numero, estado }) => ({ prueba, numero, estado }));

  return {
    id: examen.id,
    titulo: examen.titulo,
    nivel: examen.nivel,
    numeroEnCuadernillo: examen.numeroEnCuadernillo,
    cuadernillo:
      examen.cuadernillo && estructura
        ? {
            id: examen.cuadernillo.id,
            titulo: examen.cuadernillo.titulo,
            resumen: resumenDeSoluciones(examen.cuadernillo.soluciones as Soluciones, estructura),
          }
        : null,
    paginas: examen.paginas.map((p) => ({ id: p.id, ficheroId: p.ficheroId, orden: p.orden, etiquetas: p.etiquetas })),
    tareas,
    estado: examen.estado,
    motivosParaPublicar: motivosParaPublicar(examen.nivel, conEstado),
    gasto: await gastoDelExamen(examen.id),
  };
}

export type TareaDelTaller = {
  examen: { id: string; titulo: string };
  prueba: Prueba;
  numero: number;
  regla: ReglaTarea;
  formulario: Formulario;
  guardada: boolean;
  estado: EstadoDeTarea;
  /** null si se puede editar; si no, el mensaje que explica por qué (publicado o archivado). */
  bloqueo: string | null;
  /** Las respuestas del cuadernillo para los números de esta tarea, para enseñarlas sin editar. */
  respuestas: Record<string, string> | null;
  paginas: { ficheroId: string; orden: number }[];
  /** En las orales en directo, los temas de la tarea con la que van, para emparejar por tema. */
  temasDeLaHermana: string[] | null;
};

export async function tareaParaElTaller(examenId: string, prueba: Prueba, numero: number): Promise<TareaDelTaller | null> {
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { cuadernillo: true, paginas: { orderBy: { orden: "asc" } }, tareas: { where: { prueba }, include: CON_PIEZAS } },
  });
  if (!examen) return null;
  const regla = reglaDe(examen.nivel, prueba, numero);
  const tarea = examen.tareas.find((t) => t.numero === numero);
  if (!regla || !tarea) return null;

  const { formulario, claveGuardada } = leerTarea(tarea);
  const respuestas = respuestasDe(examen, prueba);
  const mostrado = formulario ?? formularioVacio(regla);

  let temasDeLaHermana: string[] | null = null;
  if (regla.hermana) {
    const hermana = examen.tareas.find((t) => t.numero === regla.hermana);
    const suyo = hermana ? leerTarea(hermana).formulario : null;
    temasDeLaHermana = suyo?.forma === "ORAL_SOLO" ? suyo.actividad.opciones.map((o) => o.tema) : ["", ""];
  }

  const etiqueta = etiquetaDeTarea(prueba, numero);
  return {
    examen: { id: examen.id, titulo: examen.titulo },
    prueba,
    numero,
    regla,
    formulario: mostrado,
    guardada: formulario !== null,
    estado: estadoDeTarea(regla, formulario, respuestas, claveGuardada),
    bloqueo: examen.estado === "PUBLICADO" ? MENSAJE_PUBLICADO : examen.estado === "ARCHIVADO" ? MENSAJE_ARCHIVADO : null,
    respuestas: claveDelFormulario(mostrado, respuestas),
    paginas: examen.paginas.filter((p) => p.etiquetas.includes(etiqueta)).map((p) => ({ ficheroId: p.ficheroId, orden: p.orden })),
    temasDeLaHermana,
  };
}

/**
 * Las fotos y la pista tienen que ser ficheros del almacén de material, del
 * tipo que toca. Una subida que se borró, o un id cualquiera, no se guarda.
 */
async function ficherosQueNoValen(f: Formulario): Promise<string | null> {
  const fotos = Object.values(f.medios.imagenes);
  const pista = f.medios.audio?.fichero ?? null;
  const ids = pista ? [...fotos, pista] : fotos;
  if (ids.length === 0) return null;
  const encontrados = new Map((await prisma.fichero.findMany({ where: { id: { in: ids } } })).map((x) => [x.id, x]));
  const vale = (id: string, prefijo: string) => {
    const x = encontrados.get(id);
    return x !== undefined && x.almacen === "VERCEL" && x.tipoMime.startsWith(prefijo);
  };
  if (fotos.some((id) => !vale(id, "image/"))) return "Una de las fotos ya no existe: vuelve a subirla.";
  if (pista && !vale(pista, "audio/")) return "La pista de audio ya no existe: vuelve a subirla.";
  return null;
}

/**
 * Valida contra la forma de la tarea y reescribe sus piezas en una
 * transacción. La clave se COPIA del cuadernillo en este momento; si luego
 * cambia el cuadernillo, el estado lo avisa hasta que se vuelva a guardar.
 */
export async function guardarTarea(
  examenId: string,
  prueba: Prueba,
  numero: number,
  bruto: unknown,
): Promise<{ estado: EstadoDeTarea } | { error: string }> {
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { cuadernillo: true, tareas: { where: { prueba, numero } } },
  });
  const tarea = examen?.tareas[0];
  const regla = examen ? reglaDe(examen.nivel, prueba, numero) : null;
  if (!examen || !tarea || !regla) return { error: "Esa tarea no existe." };

  const leido = esquemaDelFormulario(regla).safeParse(bruto);
  if (!leido.success) return { error: "Los datos no casan con la forma de la tarea. No se ha guardado nada." };
  const formulario = leido.data;
  const ficherosMalos = await ficherosQueNoValen(formulario);
  if (ficherosMalos) return { error: ficherosMalos };
  const respuestas = respuestasDe(examen, prueba);
  const clave = claveDelFormulario(formulario, respuestas);

  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      // Bloquea la fila de la Tarea para que dos guardados a la vez se
      // serialicen: si no, el borrado del segundo no encuentra nada que borrar
      // y sus creaciones chocan con las del primero (@@unique([tareaId, orden])).
      await tx.$queryRaw`SELECT id FROM "Tarea" WHERE id = ${tarea.id} FOR UPDATE`;
      await tx.pieza.deleteMany({ where: { tareaId: tarea.id } });
      for (const p of piezasDelFormulario(formulario)) {
        await tx.pieza.create({
          data: {
            tareaId: tarea.id,
            orden: p.orden,
            tipo: p.tipo,
            texto: p.texto,
            etiqueta: p.etiqueta,
            ficheroId: p.ficheroId,
            cortes: p.cortes,
            actividad: p.actividad
              ? {
                  create: {
                    tipo: p.actividad.tipo,
                    datos: p.actividad.datos as Prisma.InputJsonValue,
                    clave: clave ? { create: { respuestas: clave } } : undefined,
                  },
                }
              : undefined,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof ExamenNoEditable) return { error: error.message };
    throw error;
  }

  return { estado: estadoDeTarea(regla, formulario, respuestas, clave ?? {}) };
}

/** Publica si las 14 tareas están completas y cuadran. Todo se recalcula con la fila del Examen bloqueada. */
export async function publicarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado === "PUBLICADO") return {};
    if (estado === "ARCHIVADO") return { error: "Un examen archivado no se publica." };
    const examen = await tx.examen.findUniqueOrThrow({ where: { id: examenId }, include: { cuadernillo: true, tareas: { include: CON_PIEZAS } } });
    const motivos = motivosParaPublicar(examen.nivel, tareasConEstado(examen));
    if (motivos.length > 0) return { error: `No se puede publicar: ${motivos.join(" ")}` };
    await tx.examen.update({ where: { id: examenId }, data: { estado: "PUBLICADO" } });
    return {};
  });
}

/** Devuelve un examen publicado a construcción. No deja si alguien lo tiene asignado. */
export async function retirarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado !== "PUBLICADO") return { error: "Ese examen no está publicado." };
    // Dentro de la transacción que bloquea el examen: si no, una asignación que
    // entra a la vez se quedaría apuntando a un examen en construcción.
    const asignadas = await tx.asignacion.findMany({
      where: { examenId },
      include: { persona: { select: { nombre: true } } },
      orderBy: { persona: { nombre: "asc" } },
    });
    if (asignadas.length > 0) {
      return { error: `No se puede retirar: lo tienen asignado ${listaDeNombres(asignadas.map((a) => a.persona.nombre))}. Quítaselo antes.` };
    }
    await tx.examen.update({ where: { id: examenId }, data: { estado: "EN_CONSTRUCCION" } });
    return {};
  });
}

/**
 * Saca un examen de circulación. Solo desde construcción: así la comprobación de
 * asignaciones vive en un único sitio (retirar) y no hay que repetirla aquí.
 */
export async function archivarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado === "ARCHIVADO") return {};
    if (estado === "PUBLICADO") return { error: "Retíralo antes de archivarlo." };
    await tx.examen.update({ where: { id: examenId }, data: { estado: "ARCHIVADO" } });
    return {};
  });
}

export async function recuperarExamen(examenId: string): Promise<{ error?: string }> {
  const r = await prisma.examen.updateMany({ where: { id: examenId, estado: "ARCHIVADO" }, data: { estado: "EN_CONSTRUCCION" } });
  return r.count === 1 ? {} : { error: "Ese examen no está archivado." };
}
