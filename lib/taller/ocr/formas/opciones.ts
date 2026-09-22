import type { ReglaTarea } from "@/lib/dele/estructura";
import { letrasHasta } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import {
  ajustarLongitud,
  dividirEnParrafos,
  esAnclaDePregunta,
  esConversacionHeader,
  esInicioDePregunta,
  esLineaDeCita,
  esLineaDeOpcion,
  letraDelEjemplo,
  primerParrafoDesde,
  quitarMarcaDeOpcion,
  quitarNumeroDePregunta,
} from "./comun";

type Opcion = { letra: string; texto: string; conImagen: boolean };
type Pregunta = { numero: number; enunciado: string; opciones: Opcion[]; grupo: number | null };

/** Marca el arranque del bloque de ejemplo, cuando lo hay. */
const RE_EJEMPLO = /^ejemplo:?$/i;
/** Marca el arranque de la lista de preguntas, cuando el libro la titula así. */
const RE_PREGUNTAS = /^preguntas$/i;

function esLimiteDePasaje(linea: string): boolean {
  return RE_PREGUNTAS.test(linea) || RE_EJEMPLO.test(linea) || esAnclaDePregunta(linea);
}

/** El texto suelto (título + cuerpo) que precede a las preguntas, cuando la tarea trae uno. */
function leerTextoSuelto(pasaje: readonly string[][]): { etiqueta: string; texto: string } {
  const etiqueta = pasaje[1]?.join(" ") ?? "";
  const cuerpo = pasaje
    .slice(2)
    .filter((p) => !(p.length === 1 && esLineaDeCita(p[0])))
    .map((p) => p.join(" "))
    .join("\n\n");
  return { etiqueta, texto: cuerpo };
}

function opcionesVacias(letras: readonly string[], conImagen: boolean): Opcion[] {
  return letras.map((letra) => ({ letra, texto: "", conImagen }));
}

/** Construye el ejemplo a partir de sus párrafos (entre "Ejemplo:" y la primera ancla real). */
function leerEjemplo(parrafosEjemplo: readonly string[][], letras: readonly string[], esConImagen: boolean, textoCompleto: string): {
  enunciado: string;
  opciones: Opcion[];
  letra: string;
} {
  const lineas = parrafosEjemplo.flat().filter((l) => !RE_EJEMPLO.test(l));
  const finEnunciado = lineas.findIndex((l, i) => i > 0 && esLineaDeOpcion(l));
  const lineasEnunciado = finEnunciado === -1 ? lineas : lineas.slice(0, finEnunciado);
  const enunciado = quitarNumeroDePregunta(lineasEnunciado.join(" "));
  // Con imágenes, las "opciones" que ve el OCR son basura de la maqueta (bordes, letras sueltas
  // de las fotos): no hay texto que leer y no tiene sentido intentarlo.
  const opciones = esConImagen
    ? opcionesVacias(letras, true)
    : ajustarLongitud(
        (finEnunciado === -1 ? [] : agruparOpciones(lineas.slice(finEnunciado))).map(quitarMarcaDeOpcion),
        letras.length,
        () => "",
      ).map((texto, i) => ({ letra: letras[i], texto, conImagen: false }));
  return { enunciado, opciones, letra: letraDelEjemplo(textoCompleto) };
}

/**
 * Junta cada línea que ya es una opción con las que le siguen y todavía no
 * llevan marca propia: el enunciado o una opción larga a veces ocupan dos
 * líneas ("Q le han dado la oportunidad...\nlugar de nacimiento."), y sin
 * esto la segunda mitad se perdía en vez de sumarse a la opción que le toca.
 */
function agruparOpciones(lineas: readonly string[]): string[] {
  const grupos: string[][] = [];
  for (const l of lineas) {
    if (esLineaDeOpcion(l)) grupos.push([l]);
    else if (grupos.length > 0) grupos[grupos.length - 1].push(l);
  }
  return grupos.map((g) => g.join(" "));
}

/** Une las líneas de un bloque hasta la primera que ya es una opción: así el enunciado no se corta cuando el OCR lo parte en dos líneas. */
function separarEnunciadoDeOpciones(bloque: readonly string[]): { enunciado: string[]; opciones: string[] } {
  const finEnunciado = bloque.findIndex((l, i) => i > 0 && esLineaDeOpcion(l));
  if (finEnunciado === -1) return { enunciado: [...bloque], opciones: [] };
  return { enunciado: bloque.slice(0, finEnunciado), opciones: agruparOpciones(bloque.slice(finEnunciado)) };
}

/** Preguntas numeradas ("13. La tutora...", "20. En el II Premio..."): cada ancla lleva sus opciones justo detrás. */
function leerPreguntasNumeradas(lineas: readonly string[], letras: readonly string[]): { enunciado: string; opciones: string[] }[] {
  const anclas = lineas.reduce<number[]>((acc, l, i) => (esInicioDePregunta(l) ? [...acc, i] : acc), []);
  return anclas.map((inicio, i) => {
    const bloque = lineas.slice(inicio, anclas[i + 1] ?? lineas.length);
    const { enunciado, opciones } = separarEnunciadoDeOpciones(bloque);
    return { enunciado: quitarNumeroDePregunta(enunciado.join(" ")), opciones: ajustarLongitud(opciones.map(quitarMarcaDeOpcion), letras.length, () => "") };
  });
}

/**
 * Preguntas de audición por "CONVERSACIÓN N": cuando dos cabeceras caen en la
 * misma línea (maquetación a dos columnas que el OCR lee del tirón), ligar
 * cada pregunta a su cabecera ya no es fiable. En vez de eso se cogen todos
 * los "¿...?" del bloque, en el orden en que aparecen, y las opciones se
 * reparten aparte, en bloques de `letras`, saltándose las preguntas con
 * imagen (que no dejan ninguna línea de opción en el texto).
 */
function leerPreguntasDeConversacion(lineas: readonly string[], letras: readonly string[], items: number, conImagen: number): { enunciado: string; opciones: string[] }[] {
  const enunciados = lineas.join(" ").match(/¿[^¿?]*\?/g) ?? [];
  const bloques: string[][] = [];
  let actual: string[] = [];
  for (const l of lineas) {
    if (esLineaDeOpcion(l)) {
      actual.push(quitarMarcaDeOpcion(l));
      if (actual.length === letras.length) { bloques.push(actual); actual = []; }
    }
  }
  const cola = [...bloques];
  return Array.from({ length: items }, (_, i) => ({
    enunciado: enunciados[i] ?? "",
    opciones: i < conImagen ? [] : ajustarLongitud(cola.shift() ?? [], letras.length, () => ""),
  }));
}

/** Lee la tarea OPCIONES a partir del texto OCR de sus páginas. */
export function leerOpciones(texto: string, regla: ReglaTarea): FormularioDe<"OPCIONES"> {
  const letras = letrasHasta(regla.letras);
  const items = regla.items ?? 0;
  const conImagen = regla.itemsConImagen ?? 0;
  const parrafos = dividirEnParrafos(texto);

  const finDePasaje = primerParrafoDesde(parrafos, 0, esLimiteDePasaje);
  const pasaje = parrafos.slice(0, finDePasaje);
  const consigna = pasaje[0]?.join(" ") ?? "";
  const textoSuelto = regla.textos > 0 ? leerTextoSuelto(pasaje) : { etiqueta: "", texto: "" };
  const textos = ajustarLongitud(regla.textos > 0 && pasaje.length > 1 ? [textoSuelto] : [], regla.textos, () => ({ etiqueta: "", texto: "" }));

  const hayEjemplo = regla.ejemplo && RE_EJEMPLO.test(parrafos[finDePasaje]?.[0] ?? "");
  const finDeEjemplo = hayEjemplo ? primerParrafoDesde(parrafos, finDePasaje + 1, esAnclaDePregunta) : finDePasaje;
  const ejemplo = regla.ejemplo
    ? leerEjemplo(hayEjemplo ? parrafos.slice(finDePasaje, finDeEjemplo) : [], letras, conImagen > 0, texto)
    : null;

  const lineasItems = parrafos.slice(finDeEjemplo).flat();
  const brutas = lineasItems.some(esConversacionHeader)
    ? leerPreguntasDeConversacion(lineasItems, letras, items, conImagen)
    : leerPreguntasNumeradas(lineasItems, letras);
  const preguntas: Pregunta[] = ajustarLongitud(brutas, items, () => ({ enunciado: "", opciones: [] })).map((p, i) => ({
    numero: (regla.primero ?? 0) + i,
    enunciado: p.enunciado,
    opciones: ajustarLongitud(p.opciones, letras.length, () => "").map((t, j) => ({ letra: letras[j], texto: t, conImagen: i < conImagen })),
    grupo: null,
  }));

  return {
    forma: "OPCIONES",
    consigna,
    textos,
    medios: { imagenes: {}, audio: null },
    actividad: { ejemplo, preguntas },
  };
}
