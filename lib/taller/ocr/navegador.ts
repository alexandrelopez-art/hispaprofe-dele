// Solo navegador: usa document, canvas y el Worker de tesseract.js. Nunca se
// importa desde el servidor.
//
// Este es el adaptador que permite que la segmentación y el puente de
// `rotulos.ts` (escritos y probados en Node contra PNG reales de pngjs)
// corran en el navegador sin pngjs. `Lienzo` (ver imagen.ts) es la forma
// común -RGBA en un Uint8ClampedArray- que satisfacen tanto pngjs como el
// `ImageData` nativo del navegador, así que aquí no hace falta reescribir
// nada de la segmentación: solo aportar cómo se leen páginas de un PDF y
// cómo se hace OCR, ambas cosas con APIs nativas del navegador y sin
// codificar PNG a mano en ningún punto (el propio `<canvas>.toBlob()` de
// tesseract.js hace esa parte, dentro del navegador).
import type { Lienzo } from "./imagen";
// import type, nunca un import de valor: rotulos.ts importa pngjs y el
// createWorker de Node (que usa tmpdir), y ninguno de los dos existe en el
// navegador. Con `import type` el compilador garantiza que este import
// desaparece del código emitido, sin depender de que el empaquetador
// adivine que aquí solo se usan los tipos.
import type { ReconocerTexto, SesionOcr } from "./rotulos";
// Import type también para PSM (el enum de tesseract.js): solo hace falta
// como anotación de tipo aquí; el valor en tiempo de ejecución sale del
// import dinámico de dentro de crearSesionOcrNavegador, igual que createWorker.
import type { PSM } from "tesseract.js";

/**
 * El cuadernillo del taller está siempre en español. Se repite aquí (en vez
 * de importarla) porque rotulos.ts no la exporta y este archivo no debe
 * tocar rotulos.ts.
 */
const IDIOMA = "spa";

/**
 * Escala a la que se renderiza cada hoja del PDF: la misma que usa
 * `paginasDePdf` en pdf-en-navegador.ts, y la que se usó para medir el
 * corpus contra el que se calibraron los umbrales de segmentar.ts. Bajarla
 * ahorraría memoria pero perdería la resolución que el OCR necesita.
 */
const ESCALA_DE_RENDERIZADO = 2;

/** Bytes RGBA que debería tener un `Lienzo` de `ancho` x `alto`. */
function bytesRgbaEsperados(ancho: number, alto: number): number {
  return ancho * alto * 4;
}

/**
 * Si `recorte` tiene una forma que `ImageData` pueda aceptar: dimensiones
 * positivas y exactamente 4 bytes por píxel. Existe para poder rechazar un
 * `Lienzo` mal formado con un mensaje claro, en vez del error críptico que
 * lanza `ImageData` (o, peor, un lienzo en blanco silencioso) si las
 * dimensiones no cuadran con los datos.
 */
export function esLienzoValido(recorte: Lienzo): boolean {
  return recorte.ancho > 0 && recorte.alto > 0 && recorte.datos.length === bytesRgbaEsperados(recorte.ancho, recorte.alto);
}

/**
 * Un `ImageData` del navegador ya es, campo a campo, un `Lienzo` con otros
 * nombres (`width`/`height`/`data` en vez de `ancho`/`alto`/`datos`): esta
 * función es esa correspondencia, la prueba de que el contrato de Lienzo
 * (pensado para pngjs) lo satisface también el tipo nativo del navegador sin
 * ninguna conversión de verdad, solo un cambio de nombres.
 */
export function lienzoDesdeImageData(imagen: ImageData): Lienzo {
  return { ancho: imagen.width, alto: imagen.height, datos: imagen.data };
}

/**
 * Abre el PDF con pdfjs. Duplica la apertura de pdf-en-navegador.ts (en vez
 * de reutilizarla) porque esa función es privada de ese archivo y este
 * módulo no debe tocar archivos fuera de lib/taller/ocr/.
 */
async function abrirPdf(fichero: File) {
  const pdfjs = await import("pdfjs-dist");
  // No `new URL(..., import.meta.url)`: Turbopack no sabe externalizar el
  // paquete. El worker lo copia a public/ el postinstall.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ data: await fichero.arrayBuffer() }).promise;
}

/**
 * Un PDF, a un `Lienzo` (RGBA) por hoja. Procesa las páginas en secuencia,
 * nunca en paralelo, y llama a `pagina.cleanup()` en cuanto termina con cada
 * una: un cuadernillo de 14 páginas a resolución completa no puede
 * permitirse mantener vivas las cachés internas de pdfjs de las 14 páginas a
 * la vez en una máquina de 8 GB, que es el hardware objetivo. Lo único que
 * sobrevive de cada iteración es el `Uint8ClampedArray` ya copiado por
 * `getImageData` en el `Lienzo` de salida.
 */
export async function lienzosDePdf(fichero: File): Promise<Lienzo[]> {
  const doc = await abrirPdf(fichero);
  const lienzos: Lienzo[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: ESCALA_DE_RENDERIZADO });
    const canvas = document.createElement("canvas");
    canvas.width = vista.width;
    canvas.height = vista.height;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("El navegador no puede crear un contexto 2D de canvas.");
    await pagina.render({ canvasContext: contexto, viewport: vista, canvas }).promise;
    lienzos.push(lienzoDesdeImageData(contexto.getImageData(0, 0, canvas.width, canvas.height)));
    // Libera la caché de fuentes y de render de esta página antes de pasar a
    // la siguiente, en vez de dejar que las 14 se acumulen hasta que el
    // documento entero termine.
    pagina.cleanup();
  }
  return lienzos;
}

/**
 * Materializa un `Lienzo` como un `<canvas>` real: aquí es donde el
 * navegador hace lo que en Node hacía `pngjs` (empaquetar RGBA en algo que
 * tesseract.js sepa leer), pero sin ninguna librería de por medio. El propio
 * `worker.recognize` de tesseract.js, al recibir un `<canvas>`, lo convierte
 * a PNG con el `.toBlob()` nativo del navegador (confirmado leyendo
 * `tesseract.js/src/worker/browser/loadImage.js` de la versión instalada) -
 * ninguna codificación de PNG ocurre en este archivo ni en ningún paquete.
 */
function canvasDelLienzo(recorte: Lienzo): HTMLCanvasElement {
  if (!esLienzoValido(recorte)) {
    throw new Error(`Lienzo mal formado: ${recorte.ancho}x${recorte.alto} necesita ${bytesRgbaEsperados(recorte.ancho, recorte.alto)} bytes RGBA, pero trae ${recorte.datos.length}.`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = recorte.ancho;
  canvas.height = recorte.alto;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("El navegador no puede crear un contexto 2D de canvas.");
  // `new Uint8ClampedArray(recorte.datos)` en vez de pasar `recorte.datos`
  // tal cual: `Lienzo.datos` acepta cualquier `ArrayBufferLike` (para poder
  // venir tanto de pngjs como de `ImageData`), pero el constructor de
  // `ImageData` exige un `ArrayBuffer` normal, nunca un `SharedArrayBuffer`.
  // Esta copia se lo garantiza sin tocar el tipo `Lienzo` (fuera de este
  // archivo) para estrechárselo a los demás usos.
  contexto.putImageData(new ImageData(new Uint8ClampedArray(recorte.datos), recorte.ancho, recorte.alto), 0, 0);
  return canvas;
}

/**
 * Rutas propias para servir los recursos de tesseract.js (el script del
 * worker, el núcleo WASM y el `.traineddata` del idioma) desde nuestro
 * propio origen en vez del CDN de jsdelivr por defecto. Sin ellas, todo
 * sigue funcionando -tesseract.js cae a sus defaults de CDN-, así que
 * `crearSesionOcrNavegador` puede llamarse hoy sin tener estos ficheros
 * alojados todavía.
 */
export type OpcionesSesionOcrNavegador = {
  readonly workerPath?: string;
  readonly corePath?: string;
  readonly langPath?: string;
};

/**
 * Quita las claves con valor `undefined` de un objeto de opciones. Hace
 * falta porque tesseract.js arma sus opciones finales con
 * `{...defaultOptions, ...opciones}`: si `opciones` trajera, por ejemplo,
 * `workerPath: undefined` de forma explícita, ese `undefined` pisaría el
 * default del CDN en vez de dejarlo pasar, y el worker se quedaría sin saber
 * de dónde cargar su script.
 */
function sinIndefinidos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Abre un worker de tesseract.js en español, listo para reconocer tiras
 * recortadas del cuadernillo. Un único worker se reutiliza para todas las
 * páginas de un mismo cuadernillo: crear uno por recorte sería lentísimo
 * (cada worker carga el núcleo WASM y el `.traineddata` del idioma). Import
 * dinámico de "tesseract.js" -igual que pdf-en-navegador.ts hace con
 * "pdfjs-dist"- para que no entre en el bundle inicial de la página.
 *
 * Igual que `crearSesionOcr` en ./rotulos (que este archivo no puede
 * importar: usa `createWorker` de Node con `tmpdir`, que no existe en el
 * navegador), expone dos funciones sobre el mismo worker que solo difieren
 * en el modo de segmentación que fuerzan antes de reconocer: por qué ver el
 * comentario de MODO_ROTULO/MODO_CUERPO en rotulos.ts, palabra por palabra
 * el mismo razonamiento, válido también aquí.
 */
export async function crearSesionOcrNavegador(opciones: OpcionesSesionOcrNavegador = {}): Promise<SesionOcr> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(IDIOMA, undefined, sinIndefinidos(opciones));

  const reconocerConModo =
    (modo: PSM): ReconocerTexto =>
    async (recorte) => {
      await worker.setParameters({ tessedit_pageseg_mode: modo });
      const { data } = await worker.recognize(canvasDelLienzo(recorte));
      return data.text;
    };

  return {
    reconocerRotulo: reconocerConModo(PSM.SINGLE_BLOCK),
    reconocerCuerpo: reconocerConModo(PSM.AUTO),
    cerrar: async () => {
      await worker.terminate();
    },
  };
}
