import type { ReglaTarea } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import { ajustarLongitud, dividirEnParrafos } from "./comun";

/**
 * Lectores de las dos tareas de expresión escrita (EE): REDACCION_UNA (un
 * único correo que contestar) y REDACCION_DOS (una redacción a elegir entre
 * dos opciones). Son prosa libre, no ítems numerados: lo único que hay que
 * localizar son los bloques de la tarea, sus viñetas y el rango de palabras.
 */

/** Un rango leído del texto ("entre 60 y 70 palabras"); null en el extremo que el OCR no revela. */
export type Rango = { min: number | null; max: number | null };

const OPCIONES_ABIERTAS = 2;
/** Tope del esquema (`pautas` en lib/taller/formas.ts): una entrevista mal segmentada puede generar muchas más. */
export const MAXIMO_DE_PAUTAS = 12;

/** Números en palabras que usa el cuadernillo para minutos ("durante uno o dos minutos"). */
const NUMEROS_EN_PALABRAS: Readonly<Record<string, number>> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

/** Un número, en cifra o en palabra ("70" o "dos"); null si no es ninguno de los dos (p. ej. "no", corrupción OCR de "110"). */
export function numeroDeToken(token: string): number | null {
  const limpio = token.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, "");
  if (/^\d+$/.test(limpio)) return Number(limpio);
  return NUMEROS_EN_PALABRAS[limpio] ?? null;
}

/** El rango de palabras de la redacción ("Número de palabras (recomendado): entre X y Y."). */
export function leerRangoDePalabras(textoPlano: string): Rango {
  const m = textoPlano.match(/n[uú]mero de palabras(?:\s+recomendado)?\s*:\s*entre\s+(\w+)\s+y\s+(\w+)/i);
  if (!m) return { min: null, max: null };
  return { min: numeroDeToken(m[1]), max: numeroDeToken(m[2]) };
}

/**
 * Recorta `texto` a los bloques de "TAREA {numero}": desde su propia
 * cabecera hasta la siguiente cabecera de tarea o de prueba. Una misma hoja
 * del cuadernillo trae a menudo el final de la tarea anterior, la tarea
 * siguiente o el arranque de la prueba oral pegados a continuación (las
 * tareas comparten página y el recorte que llega no es siempre el de una
 * sola); sin este filtro por número, ese contenido ajeno se colaría en la
 * tarea que se está leyendo. Si no aparece ninguna cabecera de tarea en
 * absoluto (el recorte ya venía limpio, o es puro ruido), se devuelve el
 * texto tal cual: es preferible intentar leerlo entero a descartarlo.
 */
export function extraerBloquesDeTarea(texto: string, numero: number): string[] {
  const lineas = texto.split(/\r?\n/);
  const esEstaTarea = (linea: string) => new RegExp(`^tarea\\s+${numero}\\b`, "i").test(linea.trim());
  const esLimiteDeBloque = (linea: string) => {
    const t = linea.trim();
    return /^tarea\s+\d+\b/i.test(t) || /^(la\s+)?prueba de/i.test(t);
  };
  if (!lineas.some((l) => /^tarea\s+\d+\b/i.test(l.trim()))) return [texto];

  const bloques: string[] = [];
  let actual: string[] | null = null;
  for (const linea of lineas) {
    if (esEstaTarea(linea)) {
      if (actual) bloques.push(actual.join("\n"));
      actual = [linea];
    } else if (esLimiteDeBloque(linea)) {
      if (actual) bloques.push(actual.join("\n"));
      actual = null;
    } else if (actual) {
      actual.push(linea);
    }
  }
  if (actual) bloques.push(actual.join("\n"));
  return bloques;
}

/** El bloque de una tarea sin opciones (REDACCION_UNA): junta, por si acaso, más de una cabecera repetida del mismo número. */
function recortarTarea(texto: string, numero: number): string {
  return extraerBloquesDeTarea(texto, numero).join("\n\n");
}

/**
 * Un resto suelto del rótulo fijo "PRUEBA DE EXPRESIÓN E INTERACCIÓN
 * ESCRITAS/ORALES" que el OCR deja como su propio párrafo, ya sin la
 * palabra "TAREA" o "PRUEBA" delante que lo habría filtrado como andamiaje
 * en comun.ts ("DE EXPRESIÓN E INTERACCIÓN ESCRIT", "E INTERACC"...). Nunca
 * es contenido de la tarea: si no se descarta, se cuela como si fuera la
 * primera frase de la situación o del tema.
 */
function esRestoDeCabeceraDeExpresion(linea: string): boolean {
  return linea === linea.toUpperCase() && /expres|interacc/i.test(linea) && linea.length <= 45;
}

/** Los párrafos de un bloque, sin los restos sueltos de la cabecera fija de la prueba. */
export function parrafosDelBloque(bloque: string): string[][] {
  return dividirEnParrafos(bloque).filter((p) => !(p.length === 1 && esRestoDeCabeceraDeExpresion(p[0])));
}

// ---------- viñetas ("— saludar,", "- despedirte.") ----------

const RE_VINETA = /^[-–—]+\s*/;

export function esLineaDeVineta(linea: string): boolean {
  return RE_VINETA.test(linea);
}

/**
 * Agrupa líneas en pautas: una viñeta empieza una pauta nueva; lo que sigue
 * sin viñeta se suma a la última (una pauta larga que el OCR parte en dos
 * líneas). Una línea que acaba en ":" es siempre una cabecera de sección
 * ("No olvides:", "Modelo de preguntas:", "Escribe tu opinión sin
 * olvidar:") y nunca es una pauta ni la continuación de una: se descarta
 * sin sumarla a nada, tanto si cae antes de la primera viñeta como si cae
 * entre dos.
 */
export function agruparPautas(lineas: readonly string[]): string[] {
  const grupos: string[][] = [];
  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (linea.length === 0 || linea.endsWith(":")) continue;
    if (esLineaDeVineta(linea)) grupos.push([linea.replace(RE_VINETA, "").trim()]);
    else if (grupos.length > 0) grupos[grupos.length - 1].push(linea);
  }
  return grupos.map((g) => g.join(" ").trim()).filter((t) => t.length > 0).slice(0, MAXIMO_DE_PAUTAS);
}

// ---------- título en mayúsculas ("EL REGALO PERFECTO", "¿CUÁL ES TU CIUDAD FAVORITA?") ----------

function esLineaDeTitulo(linea: string): boolean {
  return linea.length >= 3 && linea.length <= 60 && linea === linea.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{2,}/.test(linea);
}

/**
 * Busca, en cualquiera de los párrafos, la primera línea que solo puede ser
 * un título (todo en mayúsculas). Ni el primer párrafo del bloque es
 * siempre el título (a veces antes va un párrafo de instrucciones
 * genéricas, "A continuación tienes un tema..."), ni el título va siempre
 * solo en su párrafo (a veces arrastra pegada la línea de la cabecera
 * siguiente, "Modelo de preguntas:"). Lo que sobra de su propio párrafo se
 * conserva en `resto`, junto con los párrafos anteriores y posteriores.
 */
export function extraerTitulo(parrafos: readonly string[][]): { titulo: string; resto: string[][] } {
  for (let i = 0; i < parrafos.length; i++) {
    const [primeraLinea, ...siguientes] = parrafos[i];
    if (primeraLinea !== undefined && esLineaDeTitulo(primeraLinea)) {
      const resto = [...parrafos.slice(0, i), ...(siguientes.length > 0 ? [siguientes] : []), ...parrafos.slice(i + 1)];
      return { titulo: primeraLinea, resto };
    }
  }
  return { titulo: "", resto: [...parrafos] };
}

// ---------- REDACCION_UNA ----------

/** Lee la tarea REDACCION_UNA (contestar a un correo recibido) a partir del texto OCR de sus páginas. */
export function leerRedaccionUna(texto: string, regla: ReglaTarea): FormularioDe<"REDACCION_UNA"> {
  const bloque = recortarTarea(texto, regla.numero);
  const parrafos = parrafosDelBloque(bloque);
  const indicePautas = parrafos.findIndex((p) => /no olvides/i.test(p[0] ?? ""));
  const finDelMensaje = indicePautas !== -1 ? indicePautas : parrafos.length;

  const situacion = parrafos[0]?.join(" ") ?? "";
  // El correo recibido: todo lo que hay entre la situación y "no olvides", saludo, cuerpo y
  // firma incluidos. Algún resto de la interfaz del cliente de correo ("RESPONDER", "[LAek:)")
  // puede colarse como su propio párrafo: se deja tal cual, nunca se inventa dónde empieza el
  // mensaje de verdad a cambio de adivinarlo.
  const textoRecibido = parrafos.slice(1, finDelMensaje).map((p) => p.join(" ")).join("\n\n");
  const pautas = indicePautas === -1 ? [] : agruparPautas(parrafos[indicePautas].slice(1));
  const palabras = leerRangoDePalabras(bloque.replace(/\s+/g, " "));

  return {
    forma: "REDACCION_UNA",
    consigna: "",
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: { situacion, textoRecibido, pautas, palabras },
  };
}

// ---------- REDACCION_DOS ----------

function partirPorOpcion(bloque: string): string[] {
  const lineas = bloque.split(/\r?\n/);
  const anclas = lineas.reduce<number[]>((acc, l, i) => (/^opci[oó]n\s+\d+/i.test(l.trim()) ? [...acc, i] : acc), []);
  if (anclas.length === 0) return [bloque];
  return anclas.map((inicio, i) => lineas.slice(inicio, anclas[i + 1] ?? lineas.length).join("\n"));
}

function leerUnaOpcionRedaccion(trozo: string): { titulo: string; contexto: string; pautas: string[] } {
  const parrafos = parrafosDelBloque(trozo)
    .map((p) => p.filter((l) => !/^opci[oó]n\s+\d+/i.test(l.trim())))
    .filter((p) => p.length > 0);
  const { titulo, resto } = extraerTitulo(parrafos);
  const indicePautas = resto.findIndex((p) => p.some(esLineaDeVineta));
  const parrafosDeContexto = indicePautas === -1 ? resto : resto.slice(0, indicePautas);
  const contexto = parrafosDeContexto.map((p) => p.join(" ")).join("\n\n");
  const pautas = indicePautas === -1 ? [] : agruparPautas(resto[indicePautas]);
  return { titulo, contexto, pautas };
}

/** La consigna compartida de la tarea ("Elige sólo una de las dos opciones..."), lo que hay antes de la primera "OPCIÓN". */
function leerConsignaDeOpciones(bloque: string): string {
  const parrafos = parrafosDelBloque(bloque);
  const finDeConsigna = parrafos.findIndex((p) => p.some((l) => /^opci[oó]n\s+\d+/i.test(l)));
  if (finDeConsigna <= 0) return "";
  return parrafos.slice(0, finDeConsigna).map((p) => p.join(" ")).join(" ");
}

/** Lee la tarea REDACCION_DOS (redacción a elegir entre dos opciones) a partir del texto OCR de sus páginas. */
export function leerRedaccionDos(texto: string, regla: ReglaTarea): FormularioDe<"REDACCION_DOS"> {
  const bloque = recortarTarea(texto, regla.numero);
  const trozos = ajustarLongitud(partirPorOpcion(bloque), OPCIONES_ABIERTAS, () => "");

  return {
    forma: "REDACCION_DOS",
    consigna: leerConsignaDeOpciones(bloque),
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: {
      opciones: trozos.map(leerUnaOpcionRedaccion),
      palabras: leerRangoDePalabras(bloque.replace(/\s+/g, " ")),
    },
  };
}
