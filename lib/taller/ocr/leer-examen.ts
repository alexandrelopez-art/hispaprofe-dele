import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { esPrueba, etiquetasDeNivel, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { Duda } from "@/lib/taller/ia/dudas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";
import { dudasDeOcr } from "./confianza";
import { ordenarYEtiquetarPaginas, type MarcaDeInicio, type SenalDePagina } from "../etiquetas-automaticas";
import { leerHuecos } from "./formas/huecos";
import { leerListaComun } from "./formas/lista-comun";
import { leerOpciones } from "./formas/opciones";
import { leerOralDirecto, leerOralSolo } from "./formas/oral";
import { leerRedaccionDos, leerRedaccionUna } from "./formas/redaccion";
import { leerRelacionar } from "./formas/relacionar";
import type { Lienzo } from "./imagen";
import { detectarRotulosDePagina, type ReconocerTexto, type RotulosDePagina } from "./rotulos";
import { bandasDePagina, partirPorElLomo } from "./segmentar";

/**
 * El ensamblador final: encadena segmentación (segmentar.ts), confirmación de
 * rótulos (rotulos.ts), orden y etiquetado (etiquetas-automaticas.ts) y los
 * ocho lectores de forma (ocr/formas/*.ts) para convertir un cuadernillo
 * escaneado completo en las catorce tareas de la estructura fija, cada una
 * con su formulario relleno y sus dudas — lo mismo que hoy hace `interpretar`
 * en ia/rellenar.ts, pero alimentado por OCR local en vez de por la IA.
 *
 * La parte que de verdad complica esto (ver `eventosDeHoja` y
 * `regionesDelTramo`) es que una tarea no vive en un rectángulo: empieza a la
 * altura de su rótulo, corre hasta el rótulo siguiente (que puede estar más
 * abajo en la misma hoja o no aparecer hasta varias hojas después) y hay que
 * recortar cada tramo por separado — nunca la hoja entera de un tirón — para
 * no perder la calidad de OCR que exige el resto del taller.
 */

/** Una página física ya partida por el lomo si venía en doble página. `indicePdf` es la posición en el array de entrada. */
export type HojaDelExamen = { indicePdf: number; lado: "izquierda" | "derecha" | null; lienzo: Lienzo };

export type ResultadoTarea = {
  etiqueta: string;
  prueba: Prueba;
  numero: number;
  formulario: Formulario;
  dudas: Duda[];
  /** Índices (en el array `paginas` de entrada) de las páginas de origen, en el orden en que aportaron texto. */
  paginasOrigen: number[];
  /** Motivo por el que se usó el formulario vacío en vez de lo leído, o null si se leyó con normalidad. */
  error: string | null;
};

export type ResultadoPagina = { indicePdf: number; lado: "izquierda" | "derecha" | null; etiquetas: string[]; segura: boolean };

export type ExamenLeido = { tareas: ResultadoTarea[]; paginas: ResultadoPagina[] };

/**
 * Las dos funciones de OCR que necesita `leerExamen`, cada una con su propio
 * modo de segmentación de página (ver MODO_ROTULO/MODO_CUERPO en rotulos.ts):
 * `reconocerRotulo` para las tiras estrechas de "TAREA N" y el pie de
 * página, `reconocerCuerpo` para el texto de cada tarea. `crearSesionOcr` (en
 * rotulos.ts) y `crearSesionOcrNavegador` (en navegador.ts) ya devuelven un
 * objeto con esta forma -y de sobra, con `cerrar`-, así que la sesión entera
 * sirve tal cual como este parámetro.
 */
export type LectorOcr = { reconocerRotulo: ReconocerTexto; reconocerCuerpo: ReconocerTexto };

/** Un tramo de una tarea dentro de una única hoja: filas `[y0, y1)` de `hojasEnOrden[hojaIndice]`. */
export type RegionDeTexto = { hojaIndice: number; y0: number; y1: number };

/** Dónde empieza, en el documento ya ordenado, el contenido de una o varias etiquetas (más de una solo en el reencuentro de una pareja de hermanas orales). */
export type EventoDeApertura = { hojaIndice: number; y: number; etiquetas: readonly string[] };

type EventoLocal = { etiquetas: readonly string[]; y: number };

/**
 * Filas por encima del rótulo siguiente que nunca se incluyen en la tarea
 * anterior: el título "TAREA N" arranca entre 33 y 46 px por encima de su
 * raya (medido en rotulos.ts), y sin este margen ese título se colaría como
 * cola de la tarea de antes — o, peor, como si fuera contenido real de la
 * tarea que abre, corrompiendo a lectores como opciones.ts que no saben
 * cortar por número (a diferencia de redaccion.ts, que sí filtra por
 * "TAREA N" pero como red de seguridad, no como diseño principal).
 */
const MARGEN_ANTES_DEL_SIGUIENTE_ROTULO = 50;

/** Duda a nivel de tarea entera (no de un campo): fallo de estructura o ausencia total de páginas. */
const CLAVE_DUDA_DE_TAREA = "_tarea";

/**
 * Cabecera ("PRUEBA DE COMPRENSIÓN AUDITIVA") o primera frase de su párrafo
 * de introducción ("La prueba de Expresión e interacción orales tiene una
 * duración...") con la que el cuadernillo anuncia una prueba nueva. Cuando
 * una tarea no encuentra su propio rótulo en una hoja y hereda desde la
 * cabecera de página (ver `eventosDeHoja`), y esa misma hoja es donde
 * empieza la prueba siguiente, este título y su párrafo llegan pegados a la
 * cola de la tarea anterior aunque no sean contenido suyo -confirmado contra
 * el corpus en CE-4, que se traga la intro de "Comprensión auditiva" antes
 * de que aparezca el rótulo real de CO-1-. El mismo patrón que ya usa
 * `esLineaDeAndamiaje` en formas/comun.ts para descartar esa frase línea a
 * línea; aquí hace falta algo más fuerte que descartar una línea suelta.
 */
const PATRON_INICIO_DE_OTRA_PRUEBA = /^(la )?prueba de/i;

/**
 * Corta el texto ya ensamblado de una tarea justo antes de la primera línea
 * -a partir de la segunda línea con contenido- que anuncia una prueba
 * distinta. Nunca corta en la primera línea con contenido: en el caso límite
 * de que una tarea no encontrara su propio rótulo y su región arrancara
 * literalmente en la cabecera de página, esa primera línea podría ser la
 * cabecera legítima de su propia prueba, no una fuga de la siguiente.
 */
function recortarAntesDeOtraPrueba(texto: string): string {
  const lineas = texto.split(/\r?\n/);
  let vistaAlguna = false;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (linea.length === 0) continue;
    if (vistaAlguna && PATRON_INICIO_DE_OTRA_PRUEBA.test(linea)) return lineas.slice(0, i).join("\n");
    vistaAlguna = true;
  }
  return texto;
}

function dudaDeFallo(mensaje: string): Duda {
  return { clave: CLAVE_DUDA_DE_TAREA, nota: `No se pudo interpretar esta tarea automáticamente: ${mensaje}` };
}

const DUDA_SIN_PAGINAS: Duda = {
  clave: CLAVE_DUDA_DE_TAREA,
  nota: "No se encontró ninguna página etiquetada para esta tarea: revisa el orden y las etiquetas de las páginas.",
};

/** Parte una página del PDF por el lomo (si venía en doble página) y numera cada mitad para poder volver a la página de origen. */
export function dividirEnHojas(paginas: readonly Lienzo[]): HojaDelExamen[] {
  return paginas.flatMap((lienzo, indicePdf): HojaDelExamen[] => {
    const partes = partirPorElLomo(lienzo);
    if (partes.length === 1) return [{ indicePdf, lado: null, lienzo: partes[0] }];
    return [
      { indicePdf, lado: "izquierda", lienzo: partes[0] },
      { indicePdf, lado: "derecha", lienzo: partes[1] },
    ];
  });
}

function idDeHoja(hoja: HojaDelExamen): string {
  return `${hoja.indicePdf}:${hoja.lado ?? "u"}`;
}

/** La `y` de una marca (normalizada, 1 = arriba) en píxeles reales de una hoja de `alto` filas. */
export function pixelYDeMarca(marca: MarcaDeInicio, alto: number): number {
  return Math.round((1 - marca.y) * alto);
}

function numeroDeEtiqueta(etiqueta: string): number {
  return Number(etiqueta.split("-")[1]);
}

/**
 * Los eventos de apertura de una hoja, de arriba abajo. Los rótulos
 * confirmados (100 % de precisión medida contra el corpus) se casan desde
 * abajo con el final de la lista de etiquetas de la página: por construcción
 * de `ordenarYEtiquetarPaginas`, los rótulos nuevos son siempre el sufijo de
 * esa lista y lo heredado (si lo hay) el prefijo. Casar desde abajo evita que
 * un número de tarea repetido entre pruebas (CE-1/CO-1/EO-1 comparten el
 * "1") confunda una etiqueta heredada con el rótulo de la que de verdad abre
 * aquí. Lo heredado —cuando sobra etiqueta sin rótulo que la respalde—
 * arranca siempre al principio del cuerpo de la página (bajo la cabecera):
 * es la cola de una tarea que ya venía de antes, nunca algo que esta hoja
 * inicia.
 */
export function eventosDeHoja(etiquetas: readonly string[], inicios: readonly MarcaDeInicio[], lienzo: Lienzo): EventoLocal[] {
  const marcas = [...inicios].sort((a, b) => b.y - a.y); // de arriba (y alto) a abajo (y bajo), como en etiquetas-automaticas.ts
  const yPorIndice: (number | null)[] = etiquetas.map(() => null);
  let j = marcas.length - 1;
  for (let i = etiquetas.length - 1; i >= 0; i--) {
    const numero = numeroDeEtiqueta(etiquetas[i]);
    while (j >= 0 && marcas[j].numero !== numero) j--;
    if (j < 0) break; // sin más rótulos: el resto (hacia el principio) es heredado
    yPorIndice[i] = pixelYDeMarca(marcas[j], lienzo.alto);
    j--;
  }

  const primerNuevo = yPorIndice.findIndex((y) => y !== null);
  const finHeredado = primerNuevo === -1 ? etiquetas.length : primerNuevo;
  const eventos: EventoLocal[] = [];
  if (finHeredado > 0) eventos.push({ etiquetas: etiquetas.slice(0, finHeredado), y: bandasDePagina(lienzo).cabecera });
  for (let i = finHeredado; i < etiquetas.length; i++) eventos.push({ etiquetas: [etiquetas[i]], y: yPorIndice[i]! });
  return eventos;
}

type PuntoFinal = { hojaIndice: number; y: number; esRotuloSiguiente: boolean };

function finDelTramo(siguiente: EventoDeApertura | null, hojasEnOrden: readonly HojaDelExamen[]): PuntoFinal {
  if (siguiente) return { hojaIndice: siguiente.hojaIndice, y: siguiente.y, esRotuloSiguiente: true };
  const ultima = hojasEnOrden.length - 1;
  return { hojaIndice: ultima, y: bandasDePagina(hojasEnOrden[ultima].lienzo).pie, esRotuloSiguiente: false };
}

/**
 * Los tramos (uno o varios, si el evento siguiente cae en otra hoja) que
 * cubre el contenido abierto por `actual` hasta que lo cierra `siguiente` (o
 * el final del documento, si no hay siguiente). Cada tramo recorta como
 * mucho una hoja: el de en medio, si los hay, siempre es el cuerpo entero
 * (entre cabecera y pie), nunca la hoja completa de borde a borde.
 */
export function regionesDelTramo(
  actual: EventoDeApertura,
  siguiente: EventoDeApertura | null,
  hojasEnOrden: readonly HojaDelExamen[],
): RegionDeTexto[] {
  const fin = finDelTramo(siguiente, hojasEnOrden);
  const recorteConMargen = (y: number) => (fin.esRotuloSiguiente ? y - MARGEN_ANTES_DEL_SIGUIENTE_ROTULO : y);

  if (fin.hojaIndice === actual.hojaIndice) {
    const y1 = Math.max(actual.y, recorteConMargen(fin.y));
    return [{ hojaIndice: actual.hojaIndice, y0: actual.y, y1 }].filter((r) => r.y1 > r.y0);
  }

  const regiones: RegionDeTexto[] = [
    { hojaIndice: actual.hojaIndice, y0: actual.y, y1: bandasDePagina(hojasEnOrden[actual.hojaIndice].lienzo).pie },
  ];
  for (let h = actual.hojaIndice + 1; h < fin.hojaIndice; h++) {
    const { cabecera, pie } = bandasDePagina(hojasEnOrden[h].lienzo);
    regiones.push({ hojaIndice: h, y0: cabecera, y1: pie });
  }
  const cabeceraFinal = bandasDePagina(hojasEnOrden[fin.hojaIndice].lienzo).cabecera;
  regiones.push({ hojaIndice: fin.hojaIndice, y0: cabeceraFinal, y1: Math.max(cabeceraFinal, recorteConMargen(fin.y)) });
  return regiones.filter((r) => r.y1 > r.y0);
}

/** Recorta las filas `[y0, y1)`. Duplica `recortarFilas` de ./rotulos (no exportada, y ese fichero está vetado para tocar aquí). */
function recortarFilas(lienzo: Lienzo, y0: number, y1: number): Lienzo {
  const y0c = Math.max(0, Math.min(lienzo.alto, Math.round(y0)));
  const y1c = Math.max(0, Math.min(lienzo.alto, Math.round(y1)));
  const alto = Math.max(0, y1c - y0c);
  const datos = new Uint8ClampedArray(lienzo.ancho * alto * 4);
  datos.set(lienzo.datos.subarray(lienzo.ancho * y0c * 4, lienzo.ancho * y1c * 4));
  return { ancho: lienzo.ancho, alto, datos };
}

/**
 * El texto de una tarea: cada tramo se OCR por separado (nunca una hoja
 * entera de un tirón) y se juntan con una línea en blanco. `reconocerCuerpo`
 * -a diferencia del `reconocerRotulo` de rotulos.ts- pide PSM.AUTO (ver
 * MODO_CUERPO en rotulos.ts): sin él, tesseract.js no separa párrafos con
 * líneas en blanco y los lectores de forma que trocean por párrafo
 * (dividirEnParrafos, en formas/comun.ts) reciben la tarea entera como un
 * único bloque. El recorte final se pasa por `recortarAntesDeOtraPrueba`
 * porque el último tramo de una tarea heredada puede arrastrar, además de su
 * propia cola, el título e intro de la prueba siguiente (ver esa función).
 */
async function textoDeRegiones(regiones: readonly RegionDeTexto[], hojasEnOrden: readonly HojaDelExamen[], reconocerCuerpo: ReconocerTexto): Promise<string> {
  const textos: string[] = [];
  for (const r of regiones) {
    const recorte = recortarFilas(hojasEnOrden[r.hojaIndice].lienzo, r.y0, r.y1);
    if (recorte.alto === 0) continue;
    textos.push(await reconocerCuerpo(recorte));
  }
  return recortarAntesDeOtraPrueba(textos.join("\n\n"));
}

/** Las páginas de origen (índices del PDF de entrada) que aportaron algún tramo, en orden de primera aparición y sin repetir. */
function paginasDeRegiones(regiones: readonly RegionDeTexto[], hojasEnOrden: readonly HojaDelExamen[]): number[] {
  const vistas = new Set<number>();
  const orden: number[] = [];
  for (const r of regiones) {
    const indicePdf = hojasEnOrden[r.hojaIndice].indicePdf;
    if (!vistas.has(indicePdf)) {
      vistas.add(indicePdf);
      orden.push(indicePdf);
    }
  }
  return orden;
}

export function partirEtiqueta(etiqueta: string): { prueba: Prueba; numero: number } {
  const [prueba, numero] = etiqueta.split("-");
  if (!esPrueba(prueba)) throw new Error(`Etiqueta de estructura inesperada: ${etiqueta}`);
  return { prueba, numero: Number(numero) };
}

function leerFormulario(regla: Readonly<ReglaTarea>, texto: string): Formulario {
  switch (regla.forma) {
    case "RELACIONAR":
      return leerRelacionar(texto, regla);
    case "LISTA_COMUN":
      return leerListaComun(texto, regla);
    case "OPCIONES":
      return leerOpciones(texto, regla);
    case "HUECOS":
      return leerHuecos(texto, regla);
    case "REDACCION_UNA":
      return leerRedaccionUna(texto, regla);
    case "REDACCION_DOS":
      return leerRedaccionDos(texto, regla);
    case "ORAL_SOLO":
      return leerOralSolo(texto, regla);
    case "ORAL_DIRECTO":
      return leerOralDirecto(texto, regla);
  }
}

/**
 * Lee y valida una tarea completa. Nunca lanza: cualquier fallo (una región
 * ilegible, un lector que no cuadra con la regla) se convierte en el
 * formulario vacío más una duda explicando el motivo, para que una tarea
 * mal escaneada no se lleve por delante a las otras trece.
 */
async function procesarTarea(
  nivel: Nivel,
  etiqueta: string,
  regiones: readonly RegionDeTexto[],
  hojasEnOrden: readonly HojaDelExamen[],
  reconocerCuerpo: ReconocerTexto,
): Promise<ResultadoTarea> {
  const { prueba, numero } = partirEtiqueta(etiqueta);
  const regla = reglaDe(nivel, prueba, numero)!; // invariante: `etiqueta` viene de etiquetasDeNivel(nivel), que usa la misma ESTRUCTURAS
  const paginasOrigen = paginasDeRegiones(regiones, hojasEnOrden);

  if (regiones.length === 0) {
    const formulario = formularioVacio(regla);
    return { etiqueta, prueba, numero, formulario, dudas: [...dudasDeOcr(formulario), DUDA_SIN_PAGINAS], paginasOrigen, error: null };
  }

  try {
    const texto = await textoDeRegiones(regiones, hojasEnOrden, reconocerCuerpo);
    const leido = leerFormulario(regla, texto);
    const impuesta = imponerEstructura(formularioVacio(regla), leido);
    if ("error" in impuesta) {
      const formulario = formularioVacio(regla);
      return { etiqueta, prueba, numero, formulario, dudas: [...dudasDeOcr(formulario), dudaDeFallo(impuesta.error)], paginasOrigen, error: impuesta.error };
    }
    const fallos = fallosDeForma(regla, impuesta.formulario);
    if (fallos.length > 0) {
      const formulario = formularioVacio(regla);
      return { etiqueta, prueba, numero, formulario, dudas: [...dudasDeOcr(formulario), dudaDeFallo(fallos[0])], paginasOrigen, error: fallos[0] };
    }
    return { etiqueta, prueba, numero, formulario: impuesta.formulario, dudas: dudasDeOcr(impuesta.formulario), paginasOrigen, error: null };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    const formulario = formularioVacio(regla);
    return { etiqueta, prueba, numero, formulario, dudas: [...dudasDeOcr(formulario), dudaDeFallo(mensaje)], paginasOrigen, error: mensaje };
  }
}

/**
 * Lee un cuadernillo completo: parte cada página por el lomo si hace falta,
 * confirma rótulos y números de página con `ocr.reconocerRotulo`, ordena y
 * etiqueta las hojas resultantes y, para cada una de las catorce tareas de la
 * estructura fija, recorta y OCR (con `ocr.reconocerCuerpo`) solo los tramos
 * que le pertenecen antes de pasarlos por su lector de forma. Ninguna tarea
 * puede tirar abajo a las demás: los fallos se quedan dentro de su propio
 * `ResultadoTarea`.
 */
export async function leerExamen(nivel: Nivel, paginas: readonly Lienzo[], ocr: LectorOcr): Promise<ExamenLeido> {
  const secuencia = etiquetasDeNivel(nivel);
  if (secuencia.length === 0) return { tareas: [], paginas: [] };

  const hojas = dividirEnHojas(paginas);
  const rotulosPorHoja: RotulosDePagina[] = [];
  for (const hoja of hojas) rotulosPorHoja.push(await detectarRotulosDePagina(hoja.lienzo, ocr.reconocerRotulo));

  const senales: SenalDePagina[] = hojas.map((hoja, i) => ({
    id: idDeHoja(hoja),
    numeroImpreso: rotulosPorHoja[i].numeroImpreso,
    cabecera: null,
    inicios: rotulosPorHoja[i].inicios,
  }));

  const resueltas = ordenarYEtiquetarPaginas(nivel, senales);
  const hojasEnOrden = resueltas.map((r) => hojas[r.indiceOriginal]);
  const rotulosEnOrden = resueltas.map((r) => rotulosPorHoja[r.indiceOriginal]);

  const eventos: EventoDeApertura[] = [];
  resueltas.forEach((r, k) => {
    for (const local of eventosDeHoja(r.etiquetas, rotulosEnOrden[k].inicios, hojasEnOrden[k].lienzo)) {
      eventos.push({ hojaIndice: k, y: local.y, etiquetas: local.etiquetas });
    }
  });

  const regionesPorEtiqueta = new Map<string, RegionDeTexto[]>(secuencia.map((e) => [e, []]));
  eventos.forEach((actual, i) => {
    const regiones = regionesDelTramo(actual, eventos[i + 1] ?? null, hojasEnOrden);
    for (const etiqueta of actual.etiquetas) regionesPorEtiqueta.get(etiqueta)?.push(...regiones);
  });

  const tareas: ResultadoTarea[] = [];
  for (const etiqueta of secuencia) {
    tareas.push(await procesarTarea(nivel, etiqueta, regionesPorEtiqueta.get(etiqueta) ?? [], hojasEnOrden, ocr.reconocerCuerpo));
  }

  const paginasResultado: ResultadoPagina[] = resueltas.map((r, k) => ({
    indicePdf: hojasEnOrden[k].indicePdf,
    lado: hojasEnOrden[k].lado,
    etiquetas: r.etiquetas,
    segura: r.segura,
  }));

  return { tareas, paginas: paginasResultado };
}
