/**
 * Piezas pequeñas y compartidas por los tres lectores de OCR (opciones.ts,
 * lista-comun.ts, huecos.ts). Ninguna función de aquí sabe qué forma está
 * leyendo: solo trocean texto y reconocen las marcas de maquetación del
 * cuadernillo (números de tarea, "Instrucciones", rótulos de opción...).
 *
 * Regla de oro de todo este directorio: un número o una letra que aparece en
 * el texto del OCR NUNCA se copia como dato (el hueco 21 puede llegar como
 * "2." o el ejemplo 0 como "10."). Solo sirven de ancla para saber dónde
 * empieza y dónde acaba cada trozo; el número o la letra de verdad los pone
 * `imponerEstructura` a partir de la regla.
 */

/** Frases de maquetación que el libro repite en cada tarea y que nunca son parte del contenido. */
const RE_ANDAMIAJE = [
  /^tarea\s+\d+/i,
  /instrucciones/i,
  /opciones elegidas/i,
  /^ahora tienes/i,
  /^(la )?prueba de/i,
  /^duraci[oó]n:/i,
  /^debes responder/i,
  /^haz tus tareas/i,
  /^de\s+[a-záéíóúñ]+$/i, // resto suelto de un rótulo partido por el OCR ("DE LECTURA")
];

/** Una línea que es maquetación del cuadernillo, nunca contenido de la tarea. */
export function esLineaDeAndamiaje(linea: string): boolean {
  return RE_ANDAMIAJE.some((re) => re.test(linea));
}

/** Las líneas con contenido, en orden, sin maquetación y sin líneas en blanco. */
export function limpiarLineas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !esLineaDeAndamiaje(l));
}

/**
 * Agrupa las líneas en párrafos separados por líneas en blanco, quitando la
 * maquetación por el camino (una línea de andamiaje nunca parte ni empieza
 * un párrafo). Es la base para reconocer título y cuerpo de un texto cuando
 * el OCR no es fiable con las mayúsculas (un examen pone el título en
 * versalitas y otro en minúscula normal, pero los dos lo dejan solo en su
 * propio párrafo).
 */
export function dividirEnParrafos(texto: string): string[][] {
  const parrafos: string[][] = [];
  let actual: string[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (linea.length === 0) {
      if (actual.length > 0) parrafos.push(actual);
      actual = [];
      continue;
    }
    if (esLineaDeAndamiaje(linea)) continue;
    actual.push(linea);
  }
  if (actual.length > 0) parrafos.push(actual);
  return parrafos;
}

/** El primer párrafo, desde `desde`, con alguna línea que cumple `predicado`; si no hay, el final de la lista. */
export function primerParrafoDesde(parrafos: readonly string[][], desde: number, predicado: (linea: string) => boolean): number {
  for (let i = desde; i < parrafos.length; i++) {
    if (parrafos[i].some(predicado)) return i;
  }
  return parrafos.length;
}

/** Una línea que solo es la cita de la fuente del texto, tipo "(Adaptado de: ...)". Nunca es contenido. */
export function esLineaDeCita(linea: string): boolean {
  return /^\(.*\)\.?$/.test(linea);
}

/** Devuelve exactamente `n` elementos: recorta lo que sobra, rellena lo que falta con `relleno()`. */
export function ajustarLongitud<T>(lista: readonly T[], n: number, relleno: () => T): T[] {
  if (n <= 0) return [];
  if (lista.length >= n) return lista.slice(0, n);
  return [...lista, ...Array.from({ length: n - lista.length }, relleno)];
}

// ---------- anclas de pregunta/ítem ----------

/** "13. La tutora..." o "22, En Monterrey...": un número (el que sea) seguido de la pregunta. */
export function esInicioDePregunta(linea: string): boolean {
  return /^\d{1,3}[.,)]\s+\S/.test(linea);
}

/** Cabecera de audición tipo "CONVERSACIÓN 5" (a veces dos fundidas en una sola línea por el OCR). */
export function esConversacionHeader(linea: string): boolean {
  return /conversaci[oó]n\s+\d+/i.test(linea);
}

/** Cualquier ancla de ítem: numerada o de conversación. */
export function esAnclaDePregunta(linea: string): boolean {
  return esInicioDePregunta(linea) || esConversacionHeader(linea);
}

/** Quita el número (fiable o no) del principio de un enunciado ya localizado. */
export function quitarNumeroDePregunta(linea: string): string {
  return linea.replace(/^\d{1,3}[.,)]\s*/, "").trim();
}

// ---------- opciones de una pregunta (A/B/C) ----------

/** Marcas de opción con su propia puntuación: "A)", "A.", "(", "3)", "0)", "€)"... */
const RE_MARCA_CON_PUNTUACION = /^[A-Za-z]\)|^[A-Za-z]\.|^\(|^\d\)|^[€0]\)/;
/** Marca sin puntuación: una sola letra del pequeño abecedario que el OCR confunde con "C", seguida de espacio. */
const RE_MARCA_SIN_PUNTUACION = /^[A-EOQ]\s+/;

/** Si `linea` empieza por una marca de opción (limpia o corrupta), reconocible sin ambigüedad. */
export function esLineaDeOpcion(linea: string): boolean {
  return RE_MARCA_CON_PUNTUACION.test(linea) || RE_MARCA_SIN_PUNTUACION.test(linea);
}

/** Quita la marca inicial de una línea de opción, sea cual sea su forma. El texto que sobra es la opción. */
export function quitarMarcaDeOpcion(linea: string): string {
  const conPuntuacion = linea.match(RE_MARCA_CON_PUNTUACION);
  if (conPuntuacion) return linea.slice(conPuntuacion[0].length).trim();
  const sinPuntuacion = linea.match(RE_MARCA_SIN_PUNTUACION);
  if (sinPuntuacion) return linea.slice(sinPuntuacion[0].length).trim();
  return linea.trim();
}

/**
 * Palabras españolas de una o dos letras que jamás se deben confundir con la
 * marca corrupta de la opción C (que en el corpus real sale como "O", "Q",
 * "(", "e)", "0)"...). Sin esta lista, una opción que de verdad empieza por
 * "o" o "de" se partiría por la mitad.
 */
const PALABRAS_CORTAS_COMUNES = new Set([
  "o", "y", "u", "a", "e", "el", "la", "lo", "un", "no", "ya", "su", "de", "en",
  "es", "ha", "he", "tu", "mi", "si", "va", "ve", "da", "ir", "al", "le", "me", "te",
]);

/** Una ficha suelta (ya sin espacios) que solo puede ser la marca corrupta de la opción C. */
function esMarcaCorrupta(ficha: string): boolean {
  // Ninguna palabra española lleva un paréntesis pegado: "e)" o "0)" son
  // siempre la marca, aunque "e" sola sea la conjunción y no deba contarse.
  if (ficha.includes(")")) return true;
  const nucleo = ficha.replace(/[().,]/g, "");
  if (nucleo.length === 0 || nucleo.length > 2) return false;
  // Sin pasar a minúsculas: el español no escribe "o"/"y" con mayúscula a
  // mitad de frase, así que una "O" o una "Q" sueltas ahí solo pueden ser la
  // marca corrupta, nunca la conjunción real.
  return !PALABRAS_CORTAS_COMUNES.has(nucleo);
}

/**
 * Parte en dos lo que viene después de la opción B, cuando A) y B) ya se
 * localizaron pero la marca de C se perdió o se fundió con el texto. Si no
 * se distingue el corte con confianza, todo se deja en B y C se deja en
 * blanco: es preferible eso a inventar dónde termina una y empieza la otra.
 */
function partirTrasB(resto: string): [string, string] {
  const fichas = resto.split(/\s+/).filter(Boolean);
  for (let i = 0; i < fichas.length; i++) {
    // Caso "(es": la marca "(" viene pegada a la primera palabra de C.
    if (fichas[i].startsWith("(") && fichas[i].length > 1) {
      return [fichas.slice(0, i).join(" ").trim(), [fichas[i].slice(1), ...fichas.slice(i + 1)].join(" ").trim()];
    }
    if (esMarcaCorrupta(fichas[i])) {
      return [fichas.slice(0, i).join(" ").trim(), fichas.slice(i + 1).join(" ").trim()];
    }
  }
  return [resto.trim(), ""];
}

/**
 * Divide en tres una línea con las tres opciones de un hueco pegadas
 * ("19. A) más que B) más de e) más"): A y B se localizan por su marca, que
 * el OCR respeta casi siempre; la de C es la que más falla, así que se
 * resuelve aparte con `partirTrasB`.
 */
export function partirTresOpciones(linea: string): [string, string, string] {
  const sinNumero = linea.replace(/^\s*[\dOoQq]{1,3}[.,]?\s*/, "");
  const marcaA = sinNumero.match(/^A[.)]\s*/i);
  const trasA = marcaA ? sinNumero.slice(marcaA[0].length) : sinNumero;
  const posB = trasA.search(/\bB[.)]/i);
  if (posB === -1) return [trasA.trim(), "", ""];
  const textoA = trasA.slice(0, posB).trim();
  const marcaB = trasA.slice(posB).match(/^B[.)]\s*/i)!;
  const [textoB, textoC] = partirTrasB(trasA.slice(posB + marcaB[0].length));
  return [textoA, textoB, textoC];
}

/** La letra que el cuadernillo revela del ejemplo ("La opción correcta es la B."), o "" si no aparece. */
export function letraDelEjemplo(texto: string): string {
  const m = texto.match(/opci[oó]n correcta es\s+la\s+([A-Z])/i);
  return m ? m[1].toUpperCase() : "";
}
