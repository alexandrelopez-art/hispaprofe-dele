import { prisma } from "@/lib/db";
import type { Prueba } from "@/lib/generated/prisma";
import { minutosConReloj } from "@/lib/dele/estructura";
import { formularioDePiezas, SELECT_DE_PIEZAS } from "@/lib/taller/piezas";
import { LETRAS_TOPE, notaDePrueba, palabras, seAcaboElTiempo, SE_ACABO_EL_TIEMPO, segundosQueQuedan, tardoEnVolver, type Nota } from "./motor";

// Los mensajes de error, literales (spec §9). Otras pantallas y otras tareas
// los comparan por texto: cambiar una coma aquí las rompe.
const NO_SE_HACE = "Esa prueba todavía no se puede hacer.";
const NO_ES_TUYO = "Este examen no es tuyo.";
const NO_DISPONIBLE = "Este examen ya no está disponible.";
const YA_ENTREGADA = "Esta prueba ya está entregada.";
// SE_ACABO vive en ./motor y no aquí: la pantalla de la escrita lo compara
// para saber si apagar los folios, y no puede importar este módulo (Prisma).
const SE_ACABO = SE_ACABO_EL_TIEMPO;
// El sexto mensaje: una server action es una dirección pública, cualquiera que
// la conozca puede llamarla. Una excepción ahí es un 500 sin explicación para
// una pestaña vieja; esto es un error como los otros cinco, no un fallo.
const NO_EMPEZADA = "Todavía no has empezado esta prueba.";
// El séptimo: el candado de `corregirEnLibre`. Sin él, esa función es un
// oráculo de la clave para cualquier asignación en modo COMPLETO.
const NO_LIBRE = "Este examen no es de práctica libre.";
// Los tres de la escrita. El tope no es para corregir a nadie: es para que una
// dirección pública no pueda meter un libro entero en una columna de la base.
const TEXTO_LARGO = "Ese texto es demasiado largo.";
// El número de tarea que manda el ESTUDIANTE al guardar su folio y que su
// examen no tiene. Hay otra constante con el mismo nombre y el mismo literal en
// lib/examen/corregir.ts, y es el mismo error visto desde el otro lado: allí el
// número malo lo manda el profesor al poner las bandas.
const TAREA_MALA = "Esa tarea no existe.";
const OPCION_MALA = "Esa opción no existe.";
// El tope de letras también vive en ./motor: lo comparten esta guarda y el
// `maxLength` del folio.

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
 * nota de un examen ya publicado.
 *
 * Exportada, y con TRES llamadores autorizados, ni uno más — la lista blanca
 * de `tests/examen-clave-importadores.test.ts` («quién puede leer la clave»)
 * la vigila:
 *
 * - `cerrarIntento`, en este mismo fichero: calcula la nota al entregar y la
 *   congela. Nunca devuelve la clave en sí, solo `aciertos`/`total`/`fallos`.
 * - `corregirEnLibre`, aquí también: es camino de ESTUDIANTE (práctica
 *   libre). Tampoco devuelve la clave: `notaDePrueba` da `fallos` con lo que
 *   el estudiante marcó, nunca con lo que tenía que marcar.
 * - `hojaDeRespuestas`, en `lib/examen/hoja.ts`: la ficha del profesor, la
 *   única de las tres que SÍ enseña la letra correcta — y por eso su página
 *   exige PROFESOR y ella misma exige la prueba entregada.
 */
export async function claveDeLaPrueba(examenId: string, prueba: Prueba): Promise<Record<string, string>> {
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
 * Cierra un intento. Dos caminos, y la diferencia es de fondo:
 *
 * - Lectura y auditiva: se calcula la nota con la clave y se congela aquí, en
 *   la misma escritura que la entrega. Es la única vez que se mira la `Clave`.
 * - Escrita: NO hay nota que calcular. Se cierra sin `aciertos` ni `total`, y
 *   eso es exactamente lo que la deja «esperando corrección» (motor.ts) y lo
 *   que la mete en la cola del profesor. La nota llegará cuando él firme.
 *
 * La escritura lleva `entregadaEn: null` en el propio `where`, en los dos
 * caminos: es un `updateMany` condicional, no un `update` a ciegas. Dos
 * entregas a la vez (un doble clic, o una entrega que corre con el cierre
 * automático de la guarda) pueden ver las dos `entregadaEn` en null, pero
 * solo la primera en llegar encuentra la fila y escribe; la segunda no toca
 * nada.
 */
async function cerrarIntento(
  examenId: string,
  prueba: Prueba,
  intentoId: string,
  respuestas: readonly { numero: number; letra: string }[],
  ahora: Date,
  porTiempo: boolean,
): Promise<void> {
  const nota =
    prueba === "EE"
      ? null
      : notaDePrueba(
          await claveDeLaPrueba(examenId, prueba),
          Object.fromEntries(respuestas.map((r) => [String(r.numero), r.letra])),
        );
  await prisma.intento.updateMany({
    where: { id: intentoId, entregadaEn: null },
    data: {
      entregadaEn: ahora,
      porTiempo,
      aciertos: nota?.aciertos ?? null,
      total: nota?.total ?? null,
      fallos: nota ? nota.fallos.map((f) => f.numero) : [],
    },
  });
}

/**
 * La única guarda de las cuatro escrituras que tocan un intento
 * (`corregirEnLibre` no pasa por aquí: no hay intento en modo libre, y hace
 * su propia comprobación). Comprueba, EN ESTE ORDEN: que la prueba es CE, CO
 * o EE, que hay asignación, que el examen está publicado, que el intento no
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
): Promise<{ asignacion: AsignacionAbierta; intento: IntentoAbierto | null; minutos: number | null } | { error: string }> {
  // La oral (EO) sigue fuera hasta la 3e: su pantalla no existe.
  if (prueba !== "CE" && prueba !== "CO" && prueba !== "EE") return { error: NO_SE_HACE };

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

  // Los minutos salen de aquí, y no cada quien por su cuenta: es la única
  // consulta que ya trae el nivel del examen. `entregarPrueba` los necesita
  // para saber si la entrega la manda el reloj. El modo entra en la cuenta
  // dentro de `minutosConReloj`: en libre no hay cronómetro, y sin eso una
  // redacción de práctica se cerraría sola a los cincuenta minutos.
  const minutos = minutosConReloj(asignacion.modo, asignacion.examen.nivel, prueba);
  if (intento && seAcaboElTiempo(intento.empezadaEn, minutos, ahora)) {
    await cerrarIntento(examenId, prueba, intento.id, intento.respuestas, ahora, true);
    return { error: SE_ACABO };
  }

  return { asignacion: { id: asignacion.id }, intento, minutos };
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

/**
 * Cuántas opciones tiene una tarea de la escrita, para poder rechazar una que
 * no existe. Sale del formulario guardado, no de la regla del nivel: la regla
 * dice que la tarea 2 es de opciones, pero no cuántas puso el profesor.
 * Devuelve 0 en una tarea sin opciones (la 1), y eso hace que elegir una allí
 * rebote, que es lo que tiene que pasar.
 */
async function opcionesDeLaTarea(examenId: string, tarea: number): Promise<number | null> {
  const fila = await prisma.tarea.findUnique({
    where: { examenId_prueba_numero: { examenId, prueba: "EE", numero: tarea } },
    select: { piezas: SELECT_DE_PIEZAS },
  });
  if (!fila) return null;
  const formulario = formularioDePiezas(fila.piezas);
  if (!formulario) return null;
  return formulario.forma === "REDACCION_DOS" ? formulario.actividad.opciones.length : 0;
}

/**
 * El borrador. Pasa por la misma guarda que marcar una letra —las cinco
 * comprobaciones, en el mismo orden— y escribe una sola fila por tarea con un
 * `upsert`: el navegador guarda cada pocos segundos mientras se escribe, y
 * cada guardado es el texto ENTERO, no un trozo.
 *
 * Las palabras se cuentan AQUÍ. El navegador también las cuenta para pintarlas
 * en vivo, pero lo que se guarda es lo que cuenta el servidor sobre el texto
 * que llegó: la cuenta del navegador es un adorno, no un dato.
 */
export async function guardarEscrito(
  examenId: string,
  personaId: string,
  tarea: number,
  texto: string,
  opcion: number | null,
  ahora: Date,
): Promise<{ error?: string }> {
  if (texto.length > LETRAS_TOPE) return { error: TEXTO_LARGO };

  const abierta = await abrirLaPrueba(examenId, "EE", personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  const opciones = await opcionesDeLaTarea(examenId, tarea);
  if (opciones === null) return { error: TAREA_MALA };
  if (opcion !== null && (!Number.isInteger(opcion) || opcion < 1 || opcion > opciones)) return { error: OPCION_MALA };

  await prisma.escritoDeIntento.upsert({
    where: { intentoId_tarea: { intentoId: abierta.intento!.id, tarea } },
    create: { intentoId: abierta.intento!.id, tarea, texto, palabras: palabras(texto), opcion },
    update: { texto, palabras: palabras(texto), opcion },
  });
  return {};
}

/**
 * Salirse de la pantalla a media redacción. Decisión del profesor: la escrita se
 * hace de una sentada, y salirse a buscar la respuesta cuesta el folio. Esto
 * solo APUNTA la salida; quien borra es `resolverLasSalidas`, al volver.
 *
 * Se apunta en el SERVIDOR y no solo en el navegador a propósito. Si la marca
 * viviera en el navegador, cerrar la pestaña y volver a entrar la borraría, y a
 * un chaval de catorce años ese truco le dura media tarde.
 *
 * Tres cosas más, y cada una tapa un agujero:
 *
 * - Pasa por `abrirLaPrueba` con `exigirEmpezada: true`, o sea las mismas cinco
 *   comprobaciones que guardar un folio: solo la escrita, solo si es suya, solo
 *   con el examen publicado, solo con el intento empezado y sin entregar. Una
 *   prueba YA ENTREGADA no se marca: no hay nada que se pueda perder.
 * - Solo en modo COMPLETO. En práctica libre no se marca NADA: ahí se practica,
 *   y castigar a quien practica no tiene sentido. Se pregunta por los minutos
 *   (`abierta.minutos`), que es como se pregunta «¿hay reloj?» en todo el
 *   módulo, y no por el modo otra vez.
 * - `salioEn: null` en el `where`: si ya estaba marcado NO se pisa. La cuenta va
 *   desde la PRIMERA salida, así que salir, asomarse un segundo y volver a
 *   salir no reinicia el contador.
 */
export async function salirDeLaEscrita(
  examenId: string,
  personaId: string,
  tarea: number,
  ahora: Date,
): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, "EE", personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;
  if (abierta.minutos === null) return {};

  // La tarea, comprobada como en `guardarEscrito`: una acción de servidor es una
  // dirección pública y puede llegar un número que esta escrita no tiene.
  if ((await opcionesDeLaTarea(examenId, tarea)) === null) return { error: TAREA_MALA };

  await prisma.intento.updateMany({
    where: { id: abierta.intento!.id, salioEn: null },
    data: { salioEn: ahora, salioDeTarea: tarea },
  });
  return {};
}

type Marca = { id: string; salioEn: Date | null; salioDeTarea: number | null };

/**
 * Resuelve UNA salida y dice qué tarea borró (null = ninguna). Es el corazón de
 * la regla, y es idempotente: sin marca no hace nada, y al terminar deja las
 * marcas limpias, así que la segunda llamada ya no encuentra qué resolver.
 *
 * Se borra la FILA entera del escrito, no solo su texto: la decisión del
 * profesor es que se pierde «la tarea entera», y eso incluye la opción elegida
 * en la tarea 2. Borrar la fila tiene además una ventaja que no es de adorno:
 * da igual que un guardado automático haya llegado mientras estaba fuera (en el
 * ordenador los temporizadores siguen corriendo con la pestaña oculta). La
 * tarea se pierde igual, que es la regla.
 *
 * Y solo la tarea que tenía ABIERTA: la otra ni se toca.
 */
async function resolverUnaSalida(marca: Marca, ahora: Date): Promise<number | null> {
  if (marca.salioEn === null) return null;
  const borra = tardoEnVolver(marca.salioEn, ahora) && marca.salioDeTarea !== null;
  if (borra) {
    await prisma.escritoDeIntento.deleteMany({ where: { intentoId: marca.id, tarea: marca.salioDeTarea! } });
  }
  // Las marcas se limpian SIEMPRE, haya borrado o no: son marcas vivas, no un
  // historial. Si no se limpiaran, el siguiente vistazo a la pantalla volvería a
  // contar desde la misma salida y borraría la tarea nueva.
  await prisma.intento.updateMany({ where: { id: marca.id }, data: { salioEn: null, salioDeTarea: null } });
  return borra ? marca.salioDeTarea : null;
}

/**
 * Para las pantallas que solo leen, igual que `cerrarLasQueSePasaron`: resuelve
 * las salidas pendientes de ese ámbito ANTES de que nadie lea nada. Es lo que
 * cierra el agujero de cerrar la pestaña y volver a entrar — no hace falta que
 * el navegador avise de la vuelta, porque cargar la pantalla YA es la vuelta.
 *
 * Dos filtros, y cada uno es una decisión:
 *
 * - Solo intentos SIN ENTREGAR. Una escrita ya entregada no pierde nunca lo que
 *   mandó: si al estudiante se le acabó el tiempo estando fuera y el reloj la
 *   cerró, lo entregado es lo entregado y es lo que el profesor va a corregir.
 * - Solo modo COMPLETO. En práctica libre no se borra nada, y la regla se
 *   escribe UNA vez, aquí: `salirDeLaEscrita` ni siquiera marca en libre, pero
 *   una marca vieja de un examen que luego pasó a libre no puede colarse por
 *   este camino.
 */
export async function resolverLasSalidas(
  donde: { personaId: string } | { examenId: string },
  ahora: Date,
): Promise<{ borradas: { intentoId: string; tarea: number }[] }> {
  const marcas = await prisma.intento.findMany({
    where: { entregadaEn: null, salioEn: { not: null }, asignacion: { ...donde, modo: "COMPLETO" } },
    select: { id: true, salioEn: true, salioDeTarea: true },
  });
  const borradas: { intentoId: string; tarea: number }[] = [];
  for (const marca of marcas) {
    const tarea = await resolverUnaSalida(marca, ahora);
    if (tarea !== null) borradas.push({ intentoId: marca.id, tarea });
  }
  return { borradas };
}

/**
 * Volver a la pantalla. Resuelve y devuelve qué tarea se borró, para que la
 * pantalla pueda vaciar ese folio y explicar lo que ha pasado. Mismas reglas que
 * salir: la persona sale de la sesión, solo la escrita, solo modo completo, solo
 * con el intento abierto y sin entregar.
 *
 * Quien resuelve es `resolverLasSalidas`, el MISMO que llama la página, y no una
 * copia de la regla aquí dentro: los dos caminos de vuelta —el aviso del
 * navegador y volver a cargar la dirección— tienen que acabar en el mismo sitio,
 * o el que menos borrara sería el atajo.
 */
export async function volverALaEscrita(
  examenId: string,
  personaId: string,
  ahora: Date,
): Promise<{ error?: string; borrada?: number | null }> {
  const abierta = await abrirLaPrueba(examenId, "EE", personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  const { borradas } = await resolverLasSalidas({ personaId }, ahora);
  return { borrada: borradas.find((b) => b.intentoId === abierta.intento!.id)?.tarea ?? null };
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

/**
 * El botón «Entregar». (El otro camino, el cierre automático, lo hace
 * `abrirLaPrueba` llamando a `cerrarIntento` con `porTiempo: true`.)
 *
 * `porTiempo` NO lo dice el navegador: lo decide aquí el reloj del servidor.
 * Antes entraba como argumento de la acción, y una acción de servidor es una
 * dirección pública: cualquiera podía entregar tranquilo y dejar puesto
 * «Entregada por tiempo», que es la única señal que tiene el profesor de a
 * quién se le acabó. Es verdad exactamente cuando no queda tiempo: si el
 * intento llega hasta aquí es porque la guarda no lo cerró, o sea que a lo
 * sumo está dentro de los diez segundos de gracia — justo el caso de la
 * entrega que manda el reloj del navegador. Sin reloj (la auditiva),
 * `segundosQueQuedan` devuelve null y nunca es por tiempo.
 */
export async function entregarPrueba(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  ahora: Date,
): Promise<{ error?: string }> {
  const abierta = await abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  const intento = abierta.intento!;
  const porTiempo = segundosQueQuedan(intento.empezadaEn, abierta.minutos, ahora) === 0;
  await cerrarIntento(examenId, prueba, intento.id, intento.respuestas, ahora, porTiempo);
  return {};
}

/**
 * Para las pantallas que solo leen: cierra, con `porTiempo`, los intentos de
 * ese ámbito a los que ya se les acabó el tiempo. Idempotente — solo mira los
 * que siguen sin `entregadaEn`, así que la segunda llamada no encuentra nada
 * que cerrar. Pasa las respuestas que ya cargó aquí a `cerrarIntento`: en la
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
      asignacion: { select: { examenId: true, modo: true, examen: { select: { nivel: true } } } },
    },
  });
  for (const intento of intentos) {
    // La MISMA cuenta que en abrirLaPrueba, por la misma función: esta es la
    // otra mitad del cierre automático (la que corre sin que nadie haya pulsado
    // nada, sobre una clase entera). Si aquí el modo no contara, una escrita de
    // práctica libre se cerraría sola igual, aunque la pantalla no pintara reloj.
    const minutos = minutosConReloj(intento.asignacion.modo, intento.asignacion.examen.nivel, intento.prueba);
    if (seAcaboElTiempo(intento.empezadaEn, minutos, ahora)) {
      await cerrarIntento(intento.asignacion.examenId, intento.prueba, intento.id, intento.respuestas, ahora, true);
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
