import type { ReglaTarea } from "@/lib/dele/estructura";
import { letrasHasta } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import { ajustarLongitud, dividirEnParrafos, esLineaDeCita, partirTresOpciones } from "./comun";

/**
 * El cuadernillo siempre abre la tarea con una única frase de consigna
 * ("Lee el texto y rellena los huecos...") y, justo después, en su propio
 * párrafo, el título del texto — a veces en versalitas, a veces no; la
 * maqueta es lo único constante. Por eso el título se localiza por su
 * posición (el segundo párrafo) y no por las mayúsculas.
 */
const INDICE_DEL_TITULO = 1;
const RE_OPCIONES = /^opciones$/i;

/** Sustituye, en orden de aparición, hasta `n` números sueltos (máx. 2 cifras) por sus marcadores `[N]` reales. */
function marcarHuecos(cuerpo: string, primero: number, n: number): string {
  let vistos = 0;
  // Los números de hasta dos cifras bastan para los huecos (nunca pasan de 25) y a la vez
  // descartan de un plumazo años, medidas o números de teléfono que aparezcan en el texto.
  return cuerpo.replace(/(?<![0-9])[0-9]{1,2}(?![0-9])/g, (coincidencia) => {
    if (vistos >= n) return coincidencia;
    return `[${primero + vistos++}]`;
  });
}

/**
 * El cuerpo del texto: todo lo que hay entre el título y la sección
 * "OPCIONES" — que no siempre es su propio párrafo, porque a veces el salto
 * de línea antes del primer hueco se pierde y "OPCIONES" queda pegada a
 * "19. A) ..." dentro del mismo párrafo. La cita de la fuente
 * ("(Adaptado de: ...)") se recoge aparte; a veces justo antes va la firma
 * del autor, que sí se queda dentro del cuerpo (recortarla a ciegas, cuando
 * no hay firma, se comía la última frase del texto — preferible una firma
 * de más que una frase de menos).
 */
function leerCuerpoYFuente(parrafos: readonly string[][]): { cuerpo: string[][]; fuente: string; lineasDeOpciones: string[] } {
  const cuerpo: string[][] = [];
  let fuente = "";
  for (let i = INDICE_DEL_TITULO + 1; i < parrafos.length; i++) {
    const parrafo = parrafos[i];
    const indiceOpciones = parrafo.findIndex((l) => RE_OPCIONES.test(l));
    if (indiceOpciones !== -1) {
      if (indiceOpciones > 0) cuerpo.push(parrafo.slice(0, indiceOpciones));
      return { cuerpo, fuente, lineasDeOpciones: [...parrafo.slice(indiceOpciones + 1), ...parrafos.slice(i + 1).flat()] };
    }
    if (parrafo.length === 1 && esLineaDeCita(parrafo[0])) {
      fuente = parrafo[0];
      continue;
    }
    cuerpo.push(parrafo);
  }
  return { cuerpo, fuente, lineasDeOpciones: [] };
}

/** Las opciones de cada hueco, una por línea de la sección "OPCIONES", en el orden en que aparecen. */
function leerOpcionesDeHuecos(lineas: readonly string[], letras: readonly string[]): string[][] {
  return lineas.filter((l) => l.length > 0).map((linea) => ajustarLongitud(partirTresOpciones(linea), letras.length, () => ""));
}

/** Lee la tarea HUECOS a partir del texto OCR de sus páginas. */
export function leerHuecos(texto: string, regla: ReglaTarea): FormularioDe<"HUECOS"> {
  const letras = letrasHasta(regla.letras);
  const items = regla.items ?? 0;
  const primero = regla.primero ?? 1;
  const parrafos = dividirEnParrafos(texto);

  const consigna = parrafos[0]?.join(" ") ?? "";
  const titulo = parrafos[INDICE_DEL_TITULO]?.join(" ") ?? "";
  const { cuerpo, fuente, lineasDeOpciones } = leerCuerpoYFuente(parrafos);
  const cuerpoJunto = cuerpo.map((p) => p.join(" ")).join("\n\n");
  const textoConHuecos = marcarHuecos(cuerpoJunto, primero, items);

  const opcionesPorHueco = ajustarLongitud(leerOpcionesDeHuecos(lineasDeOpciones, letras), items, () => letras.map(() => ""));

  return {
    forma: "HUECOS",
    consigna,
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: {
      titulo,
      texto: textoConHuecos,
      fuente,
      huecos: opcionesPorHueco.map((textos, i) => ({
        numero: primero + i,
        opciones: letras.map((letra, j) => ({ letra, texto: textos[j] ?? "" })),
      })),
    },
  };
}
