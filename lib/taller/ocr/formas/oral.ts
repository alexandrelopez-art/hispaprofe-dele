import type { ReglaTarea } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import { ajustarLongitud } from "./comun";
import {
  agruparPautas,
  extraerBloquesDeTarea,
  extraerTitulo,
  MAXIMO_DE_PAUTAS,
  numeroDeToken,
  parrafosDelBloque,
  type Rango,
} from "./redaccion";

/**
 * Lectores de las cuatro tareas de expresión oral (EO): ORAL_SOLO (describir
 * una foto en la 1, presentar un tema en la 3) y ORAL_DIRECTO (diálogo
 * simulado en la 2, entrevista sobre la presentación en la 4). Las cuatro
 * comparten página con sus vecinas y cada una trae dos opciones marcadas
 * como "TAREA {numero}... (OPCIÓN n)"; `extraerBloquesDeTarea` (de
 * ./redaccion, reutilizada tal cual) ya separa por número de tarea.
 */

const OPCIONES_ABIERTAS = 2;

/** El rango de minutos de la tarea, en cifra ("1-2 minutos") o en palabra ("durante uno o dos minutos"). */
export function leerRangoDeMinutos(textoPlano: string): Rango {
  const porPalabras =
    textoPlano.match(/durante\s+(\w+)\s+o\s+(\w+)\s+minutos/i) ?? textoPlano.match(/entre\s+(\w+)\s+y\s+(\w+)\s+minutos/i);
  if (porPalabras) return { min: numeroDeToken(porPalabras[1]), max: numeroDeToken(porPalabras[2]) };
  const porCifras = textoPlano.match(/(\d+)\s*[-–—]\s*(\d+)\s*minutos/i);
  if (porCifras) return { min: Number(porCifras[1]), max: Number(porCifras[2]) };
  return { min: null, max: null };
}

/**
 * Los minutos de preparación ("Tienes 12 minutos para preparar las tareas 1
 * y 3") viven en la introducción de toda la prueba oral, no en la propia
 * tarea: solo se recuperan cuando la hoja que llegó también trae esa
 * introducción. Si no, se deja en null: es un dato real que puede faltar,
 * no algo que adivinar.
 */
function leerPreparacion(textoPlano: string): number | null {
  const m = textoPlano.match(/tienes\s+(\d+)\s+minutos\s+para\s+preparar/i);
  return m ? Number(m[1]) : null;
}

// ---------- ORAL_SOLO (describir una foto / presentar un tema) ----------

function leerUnaOpcionOralSolo(bloque: string): { tema: string; pautas: string[] } {
  const { titulo, resto } = extraerTitulo(parrafosDelBloque(bloque));
  return { tema: titulo, pautas: agruparPautas(resto.flat()) };
}

/** Lee las tareas ORAL_SOLO (describir una foto en la 1, presentar un tema en la 3) a partir del texto OCR de sus páginas. */
export function leerOralSolo(texto: string, regla: ReglaTarea): FormularioDe<"ORAL_SOLO"> {
  const trozos = ajustarLongitud(extraerBloquesDeTarea(texto, regla.numero), OPCIONES_ABIERTAS, () => "");
  const textoPlano = trozos.join(" ").replace(/\s+/g, " ");

  return {
    forma: "ORAL_SOLO",
    consigna: "",
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: {
      // `conImagen` es un campo fijo: imponerEstructura lo repone desde el vacío pase lo que pase aquí.
      opciones: trozos.map((trozo) => ({ ...leerUnaOpcionOralSolo(trozo), conImagen: false })),
      minutos: leerRangoDeMinutos(textoPlano),
      preparacion: leerPreparacion(textoPlano),
    },
  };
}

// ---------- ORAL_DIRECTO (diálogo simulado / entrevista sobre la presentación) ----------

/** Frase fija que siempre cierra la tarea de entrevista: nunca es una pauta, aunque no lleve viñeta delante. */
const RE_CIERRE_DE_ENTREVISTA = /^el entrevistador también puede solicitar/i;

function separarSituacionYPapel(parrafo: readonly string[]): { situacion: string; papelExaminador: string } {
  const indice = parrafo.findIndex((l) => /el examinador/i.test(l));
  if (indice === -1) return { situacion: parrafo.join(" "), papelExaminador: "" };
  return { situacion: parrafo.slice(0, indice).join(" "), papelExaminador: parrafo.slice(indice).join(" ") };
}

/**
 * Las pautas de un diálogo son viñetas ("— recordarle..."); las de una
 * entrevista son preguntas ("¿...?") que el OCR a veces deja sin viñeta
 * alguna, cada una en su propio párrafo o varias fundidas en una misma
 * línea. Igual que `leerPreguntasDeConversacion` en opciones.ts, se cogen
 * directamente por su "¿...?" en vez de fiarse de una viñeta que puede no
 * estar.
 */
function leerPautasDeOralDirecto(resto: readonly string[][]): string[] {
  const esEntrevista = resto.some((p) => p.some((l) => /modelo de preguntas/i.test(l)));
  const lineas = resto.flat().filter((l) => !RE_CIERRE_DE_ENTREVISTA.test(l.trim()));
  if (esEntrevista) {
    const preguntas = lineas.join(" ").match(/¿[^¿?]*\?/g);
    if (preguntas && preguntas.length > 0) return preguntas.slice(0, MAXIMO_DE_PAUTAS);
  }
  return agruparPautas(lineas);
}

function leerUnaOpcionOralDirecto(bloque: string): { tema: string; situacion: string; papelExaminador: string; pautas: string[] } {
  const { titulo, resto } = extraerTitulo(parrafosDelBloque(bloque));
  const indiceExaminador = resto.findIndex((p) => p.some((l) => /el examinador/i.test(l)));
  const { situacion, papelExaminador } =
    indiceExaminador === -1 ? { situacion: "", papelExaminador: "" } : separarSituacionYPapel(resto[indiceExaminador]);
  return { tema: titulo, situacion, papelExaminador, pautas: leerPautasDeOralDirecto(resto) };
}

/** Lee las tareas ORAL_DIRECTO (diálogo simulado en la 2, entrevista sobre la presentación en la 4) a partir del texto OCR de sus páginas. */
export function leerOralDirecto(texto: string, regla: ReglaTarea): FormularioDe<"ORAL_DIRECTO"> {
  const trozos = ajustarLongitud(extraerBloquesDeTarea(texto, regla.numero), OPCIONES_ABIERTAS, () => "");
  const textoPlano = trozos.join(" ").replace(/\s+/g, " ");

  return {
    forma: "ORAL_DIRECTO",
    consigna: "",
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: { opciones: trozos.map(leerUnaOpcionOralDirecto), minutos: leerRangoDeMinutos(textoPlano) },
  };
}
