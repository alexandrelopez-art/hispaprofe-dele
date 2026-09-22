import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import { createWorker, PSM, type Worker } from "tesseract.js";
import type { MarcaDeInicio } from "@/lib/taller/etiquetas-automaticas";
import { luminancia, type Lienzo } from "./imagen";
import { bandasDePagina, reglasDeTarea } from "./segmentar";

/**
 * El puente entre la geometría pura de `segmentar.ts` (que encuentra dónde
 * *podría* haber un rótulo, con recall del 100 % pero precisión imperfecta:
 * también devuelve bordes de foto y de caja) y el resolutor de
 * `etiquetas-automaticas.ts` (que necesita `numero` de verdad). Aquí es
 * donde se lee el texto: una tira estrecha por candidata, nunca la página
 * entera, porque el OCR de recortes pequeños sale mucho más limpio que el de
 * la página completa (confirmado contra el corpus).
 */

/** El cuadernillo del taller está siempre en español. */
const IDIOMA = "spa";

/**
 * Filas por encima de la regla candidata que hay que incluir para que quepa
 * el rótulo "TAREA N" que la corona. Calibrado contra el corpus: el texto
 * del rótulo arranca entre 33 y 46 px por encima de la raya, en las páginas
 * de ~1220x1730 del libro escolar. Una tira más alta parece más segura, pero
 * en la primera página de cada prueba se traga también el párrafo de
 * "Duración: N minutos..." de más arriba — y ese párrafo extra, pegado al
 * rótulo, es justo lo que hace que tesseract deje de leer "TAREA N" entero.
 */
const FILAS_ARRIBA_DEL_ROTULO = 50;

/** Margen por debajo de la regla candidata: nunca hay texto ahí, pero deja ver la raya entera sin cortarla a la mitad. */
const FILAS_DEBAJO_DEL_ROTULO = 10;

/**
 * Margen por encima de `pie` al recortar el pie de página. En una doble
 * página, el lomo (más claro) puede cortar en dos la franja gris del pie a
 * ojos de `bandasDePagina` — la mitad con el número queda fuera del grupo
 * que cuenta como "pie" y `pie` cae unas filas más abajo de lo debido,
 * comiéndose la mitad de arriba del número. Encima del pie real solo hay
 * margen en blanco, así que este margen no arriesga colar texto del cuerpo.
 */
const MARGEN_ARRIBA_DEL_PIE = 25;

/**
 * El número de página impreso se lee en tinta oscura sobre la barra gris del
 * pie (no en blanco sobre gris, como parece a simple vista): calibrado
 * contra el corpus, el fondo de la barra ronda una luminancia de 131-135 y
 * el trazo de la tinta baja de 70. Un umbral a medio camino separa una cosa
 * de la otra sin arrastrar el degradado del borde de la barra.
 */
const UMBRAL_LUMINANCIA_PIE = 110;

/**
 * El dígito grande y en negrita del pie ("50 - cincuenta") se pierde casi
 * siempre al binarizar: su trazo, muy grueso, no sobrevive igual de bien que
 * el texto normal. La palabra en letras, en cambio, sale limpia en todas las
 * pruebas contra el corpus. Por eso `extraerNumeroImpreso` intenta primero
 * el dígito (por si un escaneo más nítido sí lo conserva) y si no aparece,
 * cae a leer el número escrito con palabras.
 */
const PATRON_DIGITO_DE_PAGINA = /\b(\d{1,4})\b/;

/**
 * Tolerante a ruido del OCR entre "TAREA" y el número: espacios de más,
 * un punto pegado, una coma... Nunca a más de unos pocos caracteres, para no
 * casar un "TAREA" cualquiera que aparezca lejos del número real (p. ej. en
 * un texto de lectura que mencione la palabra).
 */
const PATRON_ROTULO_DE_TAREA = /TAREA[^0-9]{0,6}(\d{1,2})/i;

/** El sufijo "(OPCIÓN M)", cuando lo trae el rótulo. Igual de tolerante al ruido entre las palabras y el número. */
const PATRON_VARIANTE = /OPCI[OÓ]N[^0-9]{0,3}(\d{1,2})/i;

/** Recorta las filas `[y0, y1)` de `lienzo`, sin tocar el original. Filas fuera de rango se recortan al borde. */
function recortarFilas(lienzo: Lienzo, y0: number, y1: number): Lienzo {
  const y0c = Math.max(0, Math.min(lienzo.alto, y0));
  const y1c = Math.max(0, Math.min(lienzo.alto, y1));
  const alto = Math.max(0, y1c - y0c);
  const datos = new Uint8ClampedArray(lienzo.ancho * alto * 4);
  datos.set(lienzo.datos.subarray(lienzo.ancho * y0c * 4, lienzo.ancho * y1c * 4));
  return { ancho: lienzo.ancho, alto, datos };
}

/**
 * Convierte a tinta negra sobre fondo blanco los píxeles por debajo de
 * `umbral`: así el pie de página (tinta oscura sobre una barra gris, no
 * blanco puro) queda con el contraste fuerte que el OCR necesita.
 */
function comoTintaSobreBlanco(lienzo: Lienzo, umbral: number): Lienzo {
  const datos = new Uint8ClampedArray(lienzo.datos.length);
  for (let y = 0; y < lienzo.alto; y++) {
    for (let x = 0; x < lienzo.ancho; x++) {
      const i = (lienzo.ancho * y + x) * 4;
      const v = luminancia(lienzo, x, y) < umbral ? 0 : 255;
      datos[i] = v;
      datos[i + 1] = v;
      datos[i + 2] = v;
      datos[i + 3] = 255;
    }
  }
  return { ancho: lienzo.ancho, alto: lienzo.alto, datos };
}

/** Codifica el lienzo como PNG (lo que tesseract.js sabe leer), sin depender de dónde vive el archivo. */
function codificarPng(lienzo: Lienzo): Buffer {
  const png = new PNG({ width: lienzo.ancho, height: lienzo.alto });
  Buffer.from(lienzo.datos.buffer, lienzo.datos.byteOffset, lienzo.datos.byteLength).copy(png.data);
  return PNG.sync.write(png);
}

/** Une un texto de rótulo con la posición normalizada de su regla en una `MarcaDeInicio`, o `null` si no es un rótulo de verdad. */
export function interpretarRotulo(textoOcr: string, y: number): MarcaDeInicio | null {
  const encabezado = PATRON_ROTULO_DE_TAREA.exec(textoOcr);
  if (!encabezado) return null;
  const numero = Number(encabezado[1]);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  const variante = PATRON_VARIANTE.exec(textoOcr);
  return { numero, variante: variante ? `(OPCIÓN ${variante[1]})` : null, y };
}

/** Quita los acentos y pasa a minúsculas, para que la tabla de palabras numéricas no tenga que repetir cada entrada con y sin tilde. */
function normalizarPalabra(palabra: string): string {
  return palabra
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const UNIDADES: Readonly<Record<string, number>> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};

const DECENAS: Readonly<Record<string, number>> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};

const CENTENAS: Readonly<Record<string, number>> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

/**
 * Lee un número de página escrito en palabras ("sesenta y cuatro" -> 64,
 * "ciento treinta y uno" -> 131). Existe porque el dígito en negrita del pie
 * es justo lo que peor sobrevive al OCR en este corpus; el número en letras,
 * en cambio, sí. `null` cuando el texto no encaja con ninguna combinación
 * conocida, en vez de adivinar.
 */
export function numeroDesdePalabras(texto: string): number | null {
  const palabras = normalizarPalabra(texto)
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0 && p !== "y");
  if (palabras.length === 0) return null;

  let total = 0;
  let resto = palabras;
  if (resto[0] in CENTENAS) {
    total += CENTENAS[resto[0]];
    resto = resto.slice(1);
  }
  if (resto.length === 0) return total > 0 ? total : null;

  const [siguiente, ...cola] = resto;
  if (siguiente in UNIDADES) return total + UNIDADES[siguiente];
  if (siguiente in DECENAS) {
    total += DECENAS[siguiente];
    const unidadSuelta = cola[0];
    if (unidadSuelta !== undefined && unidadSuelta in UNIDADES && UNIDADES[unidadSuelta] < 10) {
      total += UNIDADES[unidadSuelta];
    }
    return total;
  }
  return total > 0 ? total : null;
}

/** El número impreso en el pie, probando primero el dígito y cayendo a las palabras si no aparece. */
export function extraerNumeroImpreso(textoOcr: string): number | null {
  const digito = PATRON_DIGITO_DE_PAGINA.exec(textoOcr);
  if (digito) {
    const n = Number(digito[1]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return numeroDesdePalabras(textoOcr);
}

/** Lee el texto de una tira ya recortada del lienzo. La dependencia inyectable: en pruebas, una función falsa; en producción, tesseract.js de verdad. */
export type ReconocerTexto = (recorte: Lienzo) => Promise<string>;

/**
 * Modo de segmentación de página (`tessedit_pageseg_mode`) que tesseract.js
 * aplica al reconocer un recorte. Medido bit a bit contra el corpus (no solo
 * por confianza, que apenas varía entre modos): el DEFAULT de la librería
 * -nunca llamar a `setParameters`- resulta ser exactamente `SINGLE_BLOCK`, y
 * ese modo no emite NINGUNA línea en blanco entre párrafos (0 de 0 grupos en
 * la sonda). Las tiras de una sola línea (rótulos "TAREA N" y pie de página,
 * ver `detectarRotulosDePagina`) miden 100 % de precisión con él, así que se
 * mantiene sin tocar. El cuerpo de una tarea, en cambio, es varios párrafos:
 * ahí hace falta `AUTO`, el único de los tres modos probados que sí separa
 * párrafos con líneas en blanco -la señal de la que dependen los lectores de
 * forma que trocean por párrafo, ver `dividirEnParrafos` en
 * `formas/comun.ts`- sin la cual una tarea entera de varios párrafos llega
 * como un único bloque y su lector no puede separar título de cuerpo.
 */
const MODO_ROTULO = PSM.SINGLE_BLOCK;
const MODO_CUERPO = PSM.AUTO;

/**
 * Reconoce un recorte forzando `modo` justo antes de la llamada, en vez de
 * fijar el modo una vez al crear el worker: `setParameters` no recarga el
 * modelo (es un cambio de configuración en memoria, no en disco), así que el
 * coste extra es insignificante, y cada llamada queda explícita sobre qué
 * modo pide sin depender del orden en que `leerExamen` intercale rótulos y
 * cuerpo sobre el mismo worker.
 */
async function reconocerConModo(worker: Worker, recorte: Lienzo, modo: PSM): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: modo });
  const { data } = await worker.recognize(codificarPng(recorte));
  return data.text;
}

/**
 * El worker de tesseract.js vive mientras dura `SesionOcr`: crearlo por tira
 * sería lentísimo. `cerrar` lo apaga; hace falta llamarlo para que el proceso
 * (o la suite de pruebas) termine limpio. Las dos funciones de
 * reconocimiento comparten el mismo worker -abrir dos sería el doble de
 * lento para el mismo trabajo- y solo difieren en el modo de segmentación
 * que fuerzan antes de reconocer (ver MODO_ROTULO / MODO_CUERPO).
 */
export type SesionOcr = { reconocerRotulo: ReconocerTexto; reconocerCuerpo: ReconocerTexto; cerrar: () => Promise<void> };

/**
 * Abre un worker de tesseract.js en español, listo para reconocer tiras. Un
 * único worker se reutiliza para todas las páginas de un mismo cuadernillo.
 * El caché del modelo de idioma se guarda en el directorio temporal del
 * sistema y no en el directorio de trabajo: por defecto tesseract.js escribe
 * `spa.traineddata` (~3 MB) donde se lo encuentre corriendo, y eso no puede
 * terminar colándose en el repositorio en cada `npm test`.
 */
export async function crearSesionOcr(): Promise<SesionOcr> {
  const worker = await createWorker(IDIOMA, undefined, { cachePath: tmpdir() });
  return {
    reconocerRotulo: (recorte) => reconocerConModo(worker, recorte, MODO_ROTULO),
    reconocerCuerpo: (recorte) => reconocerConModo(worker, recorte, MODO_CUERPO),
    cerrar: async () => {
      await worker.terminate();
    },
  };
}

export type RotulosDePagina = {
  /** Los rótulos "TAREA N" reales encontrados en la página, listos para `ordenarYEtiquetarPaginas`. */
  inicios: MarcaDeInicio[];
  /** El número de página impreso en el pie, o `null` si no se detectó. */
  numeroImpreso: number | null;
};

/**
 * El puente en sí: recorre las candidatas de `reglasDeTarea` (geometría pura,
 * con falsos positivos) y les pasa el OCR por encima para quedarse solo con
 * las que de verdad dicen "TAREA N"; de paso, lee el número de página del
 * pie que ya localiza `bandasDePagina`. Un candidato sin texto reconocible
 * simplemente no entra en `inicios`: es preferible perder una tarea rara vez
 * mal escaneada que inventar un número.
 */
export async function detectarRotulosDePagina(lienzo: Lienzo, reconocerRotulo: ReconocerTexto): Promise<RotulosDePagina> {
  const inicios: MarcaDeInicio[] = [];
  for (const y of reglasDeTarea(lienzo)) {
    const tira = recortarFilas(lienzo, y - FILAS_ARRIBA_DEL_ROTULO, y + FILAS_DEBAJO_DEL_ROTULO);
    if (tira.alto === 0) continue;
    const texto = await reconocerRotulo(tira);
    const marca = interpretarRotulo(texto, 1 - y / lienzo.alto);
    if (marca) inicios.push(marca);
  }

  const { pie } = bandasDePagina(lienzo);
  const tiraDelPie = recortarFilas(lienzo, pie - MARGEN_ARRIBA_DEL_PIE, lienzo.alto);
  const numeroImpreso =
    tiraDelPie.alto === 0 ? null : extraerNumeroImpreso(await reconocerRotulo(comoTintaSobreBlanco(tiraDelPie, UMBRAL_LUMINANCIA_PIE)));

  return { inicios, numeroImpreso };
}
