import { esOscuro, type Lienzo } from "./imagen";

/**
 * Segmentación geométrica de una página escaneada del cuadernillo DELE.
 * Nada de esto lee texto: todo sale de correr los píxeles por filas y
 * columnas. Es justo lo que necesita el OCR de verdad (que sí lee texto):
 * recortes pequeños y correctos en vez de la página entera.
 */

/** El lomo nunca anda lejos del centro: buscarlo fuera de esta banda dejaría
 * que una foto oscura pegada a un borde lo arrastrase hacia allá. */
const INICIO_BANDA_DEL_LOMO = 0.4;
const FIN_BANDA_DEL_LOMO = 0.6;

/** Una fila cuenta como "línea ancha" (regla de tarea o barra de cabecera/pie)
 * cuando su corrida de píxeles oscuros más larga cubre al menos esta
 * fracción del ancho de la página. Calibrado contra el corpus: el texto
 * normal no supera el 2 %, una regla de tarea llega al 85 %. */
const FRACCION_MINIMA_DE_LINEA_ANCHA = 0.5;

/** Una línea ancha de más de esta altura ya no es la regla fina bajo un
 * "TAREA N": es la barra gruesa de cabecera o de pie de página. */
const ALTURA_MAXIMA_DE_REGLA = 4;

/** Cuánto del alto de la página se explora, desde cada borde, buscando su
 * barra antes de asumir que la página no lleva cabecera o pie. */
const FRACCION_DE_BUSQUEDA_DE_BARRA = 0.25;

/** Separación máxima, en píxeles, entre dos líneas anchas consecutivas para
 * contarlas como parte de la misma cuadrícula de tabla. Calibrado contra el
 * corpus: las filas de una tabla de examen caen a ~38 px una de otra; una
 * regla de tarea nunca tiene otra línea ancha así de cerca. */
const ESPACIADO_MAXIMO_DE_TABLA = 80;

/** A partir de cuántas líneas anchas seguidas y muy juntas se asume que es
 * una tabla (con sus separadores de fila) y no reglas de tarea sueltas. */
const TAMANO_MINIMO_DE_RACHA_DE_TABLA = 3;

/** Corrida de píxeles oscuros consecutivos más larga en la fila `y`. */
function corridaOscuraMasLarga(lienzo: Lienzo, y: number): number {
  let mejor = 0;
  let actual = 0;
  for (let x = 0; x < lienzo.ancho; x++) {
    if (esOscuro(lienzo, x, y)) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}

function esFilaDeLineaAncha(lienzo: Lienzo, y: number): boolean {
  return corridaOscuraMasLarga(lienzo, y) / lienzo.ancho >= FRACCION_MINIMA_DE_LINEA_ANCHA;
}

type GrupoDeFilas = { primera: number; ultima: number };

/** Agrupa filas consecutivas que cumplen `esFilaDeLineaAncha` en bloques. */
function agruparFilasDeLineaAncha(lienzo: Lienzo): GrupoDeFilas[] {
  const grupos: GrupoDeFilas[] = [];
  let inicio: number | null = null;
  for (let y = 0; y <= lienzo.alto; y++) {
    const dentro = y < lienzo.alto && esFilaDeLineaAncha(lienzo, y);
    if (dentro && inicio === null) inicio = y;
    if (!dentro && inicio !== null) {
      grupos.push({ primera: inicio, ultima: y - 1 });
      inicio = null;
    }
  }
  return grupos;
}

/**
 * Los offsets donde termina la barra de cabecera (bajo "Examen N") y donde
 * empieza la de pie (el número de página). Se buscan como el primer y el
 * último bloque de línea ancha cerca de cada borde: una regla de tarea
 * puede caer dentro de la misma zona de búsqueda, pero nunca es ni el
 * primer bloque desde arriba ni el último desde abajo.
 */
export function bandasDePagina(lienzo: Lienzo): { cabecera: number; pie: number } {
  const grupos = agruparFilasDeLineaAncha(lienzo);
  const limite = Math.round(lienzo.alto * FRACCION_DE_BUSQUEDA_DE_BARRA);
  const barraDeCabecera = grupos.find((g) => g.primera < limite);
  const barraDePie = [...grupos].reverse().find((g) => g.ultima >= lienzo.alto - limite);
  return {
    cabecera: barraDeCabecera ? barraDeCabecera.ultima + 1 : 0,
    pie: barraDePie ? barraDePie.primera : lienzo.alto,
  };
}

/**
 * Las reglas de tarea son líneas anchas pero finas (a lo sumo unos pocos
 * píxeles de alto) que caen en el cuerpo de la página, fuera de las barras
 * de cabecera y de pie. No se lee "TAREA N": esta función solo encuentra
 * dónde el libro dibuja la raya de debajo, que es geometría pura y no
 * depende de si esa página tiene la palabra "TAREA" bien o mal impresa.
 */
export function reglasDeTarea(lienzo: Lienzo): number[] {
  const { cabecera, pie } = bandasDePagina(lienzo);
  const candidatas = agruparFilasDeLineaAncha(lienzo)
    .filter((g) => g.primera >= cabecera && g.ultima < pie && g.ultima - g.primera + 1 <= ALTURA_MAXIMA_DE_REGLA)
    .map((g) => Math.round((g.primera + g.ultima) / 2));
  return quitarRachasDeTabla(candidatas);
}

/**
 * Descarta las rachas de 3 o más líneas anchas muy próximas entre sí: eso
 * es la cuadrícula de una tabla de respuestas (una raya entre cada fila),
 * no una regla de tarea. Una regla de tarea siempre está sola.
 */
function quitarRachasDeTabla(ys: readonly number[]): number[] {
  const resultado: number[] = [];
  let inicio = 0;
  while (inicio < ys.length) {
    let fin = inicio;
    while (fin + 1 < ys.length && ys[fin + 1] - ys[fin] <= ESPACIADO_MAXIMO_DE_TABLA) fin++;
    if (fin - inicio + 1 < TAMANO_MINIMO_DE_RACHA_DE_TABLA) resultado.push(...ys.slice(inicio, fin + 1));
    inicio = fin + 1;
  }
  return resultado;
}

/** Fracción de filas de `[y0, y1)` en las que la columna `x` es oscura. */
function fraccionDeOscuridadEnColumna(lienzo: Lienzo, x: number, y0: number, y1: number): number {
  let oscuras = 0;
  for (let y = y0; y < y1; y++) {
    if (esOscuro(lienzo, x, y)) oscuras++;
  }
  return oscuras / (y1 - y0);
}

/** El bloque contiguo más ancho de índices cuyo valor está pegado al mínimo. */
function bloqueMasAnchoCercaDelMinimo(valores: readonly number[]): { primero: number; ultimo: number } | null {
  const minimo = Math.min(...valores);
  const EPSILON = 1e-9;
  let mejor: { primero: number; ultimo: number } | null = null;
  let inicio: number | null = null;
  for (let i = 0; i <= valores.length; i++) {
    const dentro = i < valores.length && valores[i] <= minimo + EPSILON;
    if (dentro && inicio === null) inicio = i;
    if (!dentro && inicio !== null) {
      const candidato = { primero: inicio, ultimo: i - 1 };
      if (!mejor || candidato.ultimo - candidato.primero > mejor.ultimo - mejor.primero) mejor = candidato;
      inicio = null;
    }
  }
  return mejor;
}

/**
 * La columna del lomo: dentro de la banda plausible alrededor del centro,
 * el punto donde la página está en blanco de arriba abajo con más margen.
 * No es necesariamente blanco puro (columnas con texto disperso también
 * cuentan si son las más despejadas de la banda), así que esto degrada con
 * gracia incluso si el hueco entre páginas no es perfecto.
 */
function columnaDelLomo(lienzo: Lienzo): number | null {
  const { cabecera, pie } = bandasDePagina(lienzo);
  const y0 = cabecera;
  const y1 = pie > cabecera ? pie : lienzo.alto;
  const xInicio = Math.round(lienzo.ancho * INICIO_BANDA_DEL_LOMO);
  const xFin = Math.round(lienzo.ancho * FIN_BANDA_DEL_LOMO);
  if (xFin <= xInicio) return null;

  const fracciones: number[] = [];
  for (let x = xInicio; x < xFin; x++) fracciones.push(fraccionDeOscuridadEnColumna(lienzo, x, y0, y1));

  const bloque = bloqueMasAnchoCercaDelMinimo(fracciones);
  return bloque ? xInicio + Math.round((bloque.primero + bloque.ultimo) / 2) : null;
}

/** Recorta las columnas `[xInicio, xFin)` de `lienzo`, sin tocar el original. */
function recortarColumnas(lienzo: Lienzo, xInicio: number, xFin: number): Lienzo {
  const ancho = xFin - xInicio;
  const datos = new Uint8ClampedArray(ancho * lienzo.alto * 4);
  for (let y = 0; y < lienzo.alto; y++) {
    const origen = (lienzo.ancho * y + xInicio) * 4;
    datos.set(lienzo.datos.subarray(origen, origen + ancho * 4), ancho * y * 4);
  }
  return { ancho, alto: lienzo.alto, datos };
}

/**
 * Parte una doble página por el lomo. Una página suelta es siempre más alta
 * que ancha (perfil "single" del corpus); una doble, apaisada (perfil
 * "spread"). Cuando no hace falta partir, o cuando la banda central no deja
 * ver un lomo creíble, se devuelve la página tal cual: es preferible pasar
 * una página entera al OCR que inventar un corte a ciegas.
 */
export function partirPorElLomo(lienzo: Lienzo): Lienzo[] {
  if (lienzo.ancho <= lienzo.alto) return [lienzo];
  const corte = columnaDelLomo(lienzo);
  if (corte === null || corte <= 0 || corte >= lienzo.ancho) return [lienzo];
  return [recortarColumnas(lienzo, 0, corte), recortarColumnas(lienzo, corte, lienzo.ancho)];
}
