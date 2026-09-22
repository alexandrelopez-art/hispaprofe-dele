import type { ReglaTarea } from "@/lib/dele/estructura";
import { letrasHasta } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import {
  ajustarLongitud,
  dividirEnParrafos,
  esInicioDePregunta,
  esLineaDeCita,
  letraDelEjemplo,
  limpiarLineas,
  quitarNumeroDePregunta,
} from "./comun";

type Comun = { letra: string; texto: string };
type TextoSuelto = { etiqueta: string; texto: string };

/**
 * Cabecera de un texto con nombre propio ("A. ANIKO", "B. CARLOS"): tal cual
 * la pone el libro delante de cada relato. Toda en mayúsculas porque es un
 * nombre destacado en la maqueta, no porque el OCR lo decida — así no hace
 * falta adivinar mayúsculas de un título cualquiera. Se busca solo en la
 * primera línea de cada párrafo (a veces la cabecera arrastra ya la primera
 * frase del relato en el mismo párrafo, sin línea en blanco de por medio).
 */
const RE_CABECERA_PERSONA = /^[A-Z][.)]\s+([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*)$/;

type Cabecera = { nombre: string; indiceParrafo: number };

function encontrarCabecerasDePersona(parrafos: readonly string[][]): Cabecera[] {
  const cabeceras: Cabecera[] = [];
  parrafos.forEach((parrafo, indiceParrafo) => {
    const m = parrafo[0]?.match(RE_CABECERA_PERSONA);
    if (m) cabeceras.push({ nombre: m[1], indiceParrafo });
  });
  return cabeceras;
}

/** El relato de cada persona: desde el resto de su propio párrafo (tras la cabecera) hasta el párrafo antes de la siguiente, sin la cita de la fuente. */
function textosDesdeCabeceras(parrafos: readonly string[][], cabeceras: readonly Cabecera[]): TextoSuelto[] {
  return cabeceras.map((cabecera, i) => {
    const fin = cabeceras[i + 1]?.indiceParrafo ?? parrafos.length;
    const restoDeSuParrafo = parrafos[cabecera.indiceParrafo].slice(1);
    const siguientes = parrafos.slice(cabecera.indiceParrafo + 1, fin).filter((p) => !(p.length === 1 && esLineaDeCita(p[0])));
    const cuerpo = [restoDeSuParrafo, ...siguientes]
      .filter((p) => p.length > 0)
      .map((p) => p.join(" "))
      .join("\n\n");
    return { etiqueta: cabecera.nombre, texto: cuerpo };
  });
}

/** Une lo captado tras un conector inicial ("se refieren a", "a", "y", "o") que no es parte del nombre. */
function quitarConectorInicial(frase: string): string {
  return frase.replace(/^(se refieren a|a|y|o)\s+/i, "").trim();
}

/**
 * Cuando la tarea no reparte los textos en párrafos propios (una tabla de
 * audición, por ejemplo), la propia consigna suele nombrar la lista común:
 * "se refieren a Adriana (A), Miguel (8) o a ninguno de los dos (C)". Cada
 * tramo entre comas u "o" que acaba en un paréntesis de una letra (o un
 * dígito que la confunde) da un nombre, en el orden en que aparecen.
 */
function comunesDesdeConsigna(consigna: string, letras: readonly string[]): Comun[] {
  const tramos = consigna.split(/,|\bo\b/i).map((t) => t.trim()).filter(Boolean);
  const nombres: string[] = [];
  for (const tramo of tramos) {
    // Sin anclar al final del tramo: a veces el paréntesis va seguido de más
    // frase ("... (C). Escucharás la conversación...") y no del punto final.
    const m = tramo.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ](?:[A-Za-zÁÉÍÓÚÑáéíóúñ ]*[A-Za-zÁÉÍÓÚÑáéíóúñ])?)\s*\([A-Za-z0-9]\)/);
    if (m) nombres.push(quitarConectorInicial(m[1]));
  }
  return letras.map((letra, i) => ({ letra, texto: nombres[i] ?? "" }));
}

/** Enunciado de una pregunta ("¿Quién...?") o de un ítem declarativo con número, sea cual sea la cifra que el OCR le puso. */
function esEnunciadoDePregunta(linea: string): boolean {
  return /^¿.*\?$/.test(linea) || esInicioDePregunta(linea);
}

/** Quita el número (si lo hay) y la marca de "acertada" del ejemplo ("... Xx"), que no es texto del enunciado. */
function limpiarEnunciado(linea: string): string {
  return quitarNumeroDePregunta(linea).replace(/\s+[Xx]{1,2}\.?$/, "").trim();
}

/** Lee la tarea LISTA_COMUN a partir del texto OCR de sus páginas. */
export function leerListaComun(texto: string, regla: ReglaTarea): FormularioDe<"LISTA_COMUN"> {
  const letras = letrasHasta(regla.letras);
  const items = regla.items ?? 0;
  const primero = regla.primero ?? 1;
  const parrafos = dividirEnParrafos(texto);
  const consigna = parrafos[0]?.join(" ") ?? "";

  const cabeceras = encontrarCabecerasDePersona(parrafos);
  const comunes: Comun[] =
    cabeceras.length >= letras.length
      ? letras.map((letra, i) => ({ letra, texto: cabeceras[i]?.nombre ?? "" }))
      : comunesDesdeConsigna(consigna, letras);
  const textos = ajustarLongitud(cabeceras.length > 0 ? textosDesdeCabeceras(parrafos, cabeceras) : [], regla.textos, () => ({
    etiqueta: "",
    texto: "",
  }));

  const enunciados = limpiarLineas(texto).filter(esEnunciadoDePregunta).map(limpiarEnunciado);
  const enunciadoEjemplo = regla.ejemplo ? enunciados[0] : undefined;
  const enunciadosDeItems = ajustarLongitud(regla.ejemplo ? enunciados.slice(1) : enunciados, items, () => "");

  return {
    forma: "LISTA_COMUN",
    consigna,
    textos,
    medios: { imagenes: {}, audio: null },
    actividad: {
      comunes,
      ejemplo: regla.ejemplo ? { enunciado: enunciadoEjemplo ?? "", letra: letraDelEjemplo(texto) } : null,
      preguntas: enunciadosDeItems.map((enunciado, i) => ({ numero: primero + i, enunciado })),
    },
  };
}
