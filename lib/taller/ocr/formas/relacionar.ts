import type { ReglaTarea } from "@/lib/dele/estructura";
import { letrasHasta } from "@/lib/dele/estructura";
import type { FormularioDe } from "@/lib/taller/formas";
import { ajustarLongitud, dividirEnParrafos, letraDelEjemplo } from "./comun";

/**
 * RELACIONAR aparece dos veces por examen y las dos veces son muy distintas:
 *
 * - CE-1 (`elementosConTexto: true`): seis jóvenes con un texto propio (foto +
 *   nombre + relato) que hay que emparejar con diez anuncios/reseñas, casi
 *   siempre en maqueta decorativa (entradas rotas, postales, tipografías
 *   manuscritas). El OCR mezcla columnas y pierde rótulos aquí más que en
 *   ninguna otra forma.
 * - CO-2 (`elementosConTexto: false`): los elementos son "Mensaje 1"… "Mensaje
 *   6" sin texto que leer (son audio); los destinos son una lista limpia de
 *   diez enunciados numerados A-J. No hace falta ningún truco especial.
 *
 * Como en el resto de este directorio, el número de un elemento y la letra de
 * un destino NUNCA se copian como dato: solo anclan dónde empieza y acaba
 * cada trozo de texto. La identidad de verdad (qué hueco del formulario es
 * cada uno) la decide `imponerEstructura` a partir del ORDEN del array que
 * devolvemos, así que lo que sí importa es dejar los bloques en el orden
 * correcto — y para eso, aquí sí hace falta mirar el número o la letra que
 * imprimió el cuadernillo, aunque el OCR la estropee alguna vez: es la única
 * pista que existe de en qué fila de la maqueta a dos columnas estaba cada
 * bloque.
 */

type Elemento = { numero: number; texto: string };
type Destino = { letra: string; titulo: string; texto: string };

// ---------- trocear por anclas (compartido entre elementos y destinos) ----------

type Bloque = { clave: string; cuerpo: string };

/**
 * Corta `texto` en trozos por cada coincidencia de `re` (con el flag "g" y un
 * grupo de captura con la clave del ancla): cada trozo es lo que hay entre el
 * final de una coincidencia y el principio de la siguiente. No exige que el
 * ancla esté al principio de una línea a propósito: cuando la maqueta a dos
 * columnas funde dos rótulos en la misma línea ("3. LEILA: 6. PACO:"), el
 * segundo rótulo también corta, aunque el trozo que le toque a cada uno salga
 * mal repartido — preferible eso a no detectarlo y perder los dos.
 */
function trocearPorAnclas(texto: string, re: RegExp): Bloque[] {
  const anclas = [...texto.matchAll(re)];
  return anclas.map((m, i) => ({
    clave: m[1],
    cuerpo: texto.slice(m.index! + m[0].length, anclas[i + 1]?.index ?? texto.length).trim(),
  }));
}

/** Letras que el OCR confunde con la marca de un destino: "|" por "I" (vertical de una maqueta rotada) y "1" por "I". */
const CONFUSION_DE_LETRA: Readonly<Record<string, string>> = { "|": "I", "1": "I" };

/** Normaliza la letra de un ancla de destino; "" si no es ninguna letra válida (A-J). */
function normalizarLetra(cruda: string): string {
  const letra = (CONFUSION_DE_LETRA[cruda] ?? cruda).toUpperCase();
  return /^[A-J]$/.test(letra) ? letra : "";
}

function unaLinea(cuerpo: string): string {
  return cuerpo.replace(/\s+/g, " ").trim();
}

// ---------- CE-1: elementos con texto propio ----------

/**
 * "0. DIEGO:", "4. PABLO:"... El cero del ejemplo sale a veces como una "O"
 * mayúscula (la maqueta pone la foto y el rótulo del ejemplo pegados al resto
 * de la fila, y el OCR no siempre distingue el dígito de la letra).
 */
const RE_ANCLA_ELEMENTO = /(\d{1,2}|[Oo])[.,)]\s*[A-ZÁÉÍÓÚÑ]{2,}\s*:?/g;

function numeroDeAncla(clave: string): number {
  return /^[Oo]$/.test(clave) ? 0 : Number(clave);
}

/** Los bloques "número: relato" que se distinguen en el texto, con el 0 del ejemplo incluido si aparece. */
function bloquesDeElementos(texto: string): { numero: number; texto: string }[] {
  return trocearPorAnclas(texto, RE_ANCLA_ELEMENTO)
    .map((b) => ({ numero: numeroDeAncla(b.clave), texto: unaLinea(b.cuerpo) }))
    .filter((b) => Number.isInteger(b.numero));
}

function leerElementosConTexto(texto: string, regla: ReglaTarea): { ejemplo: string; elementos: Elemento[] } {
  const items = regla.items ?? 0;
  const primero = regla.primero ?? 1;
  const bloques = bloquesDeElementos(texto);
  const ejemplo = regla.ejemplo ? (bloques.find((b) => b.numero === 0)?.texto ?? "") : "";
  // Un mapa por número (no una lista ordenada): así un elemento que no se
  // encontró queda vacío en su propio hueco sin desplazar a los que sí se
  // encontraron después de él.
  const porNumero = new Map(bloques.filter((b) => b.numero >= primero && b.numero < primero + items).map((b) => [b.numero, b.texto]));
  return {
    ejemplo,
    elementos: Array.from({ length: items }, (_, i) => ({ numero: primero + i, texto: porNumero.get(primero + i) ?? "" })),
  };
}

/** CO-2: los elementos son "Mensaje N", sin texto que leer (van por audio). */
function elementosSinTexto(regla: ReglaTarea): Elemento[] {
  const items = regla.items ?? 0;
  const primero = regla.primero ?? 1;
  return Array.from({ length: items }, (_, i) => ({ numero: primero + i, texto: "" }));
}

// ---------- CE-1: destinos decorativos ("Texto A", "Texto B"...) ----------

/**
 * "Texto A", "Texto B"... A veces la "t" se pierde ("Texo.E") y a veces la
 * "I" sale como una barra vertical ("Texto |"): la maqueta rotada y las
 * fuentes manuscritas son justo lo que este directorio no puede arreglar del
 * todo, así que se reconoce lo más común y se deja vacío lo que no cuadre.
 */
const RE_ANCLA_DESTINO_DECORATIVO = /\bTex(?:to|o)\.?\s*([A-Za-z0-9|])(?![A-Za-z0-9])/g;

/** El título es la primera línea del bloque; el resto es el cuerpo. Con maquetas rotadas es una aproximación, no una lectura exacta. */
function separarTituloYTexto(cuerpo: string): { titulo: string; texto: string } {
  const lineas = cuerpo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const [titulo, ...resto] = lineas;
  return { titulo: titulo ?? "", texto: unaLinea(resto.join(" ")) };
}

function leerDestinosDecorativos(texto: string, letras: readonly string[]): Destino[] {
  const bloques = trocearPorAnclas(texto, RE_ANCLA_DESTINO_DECORATIVO)
    .map((b) => ({ letra: normalizarLetra(b.clave), ...separarTituloYTexto(b.cuerpo) }))
    .filter((b) => b.letra !== "");
  const porLetra = new Map(bloques.map((b) => [b.letra, b]));
  return letras.map((letra) => porLetra.get(letra) ?? { letra, titulo: "", texto: "" });
}

// ---------- CO-2: destinos en lista limpia ("A. Se puede...") ----------

/** "A. Se puede..." o "1) Es una escuela...": la "I" también sale a veces como el dígito "1", nunca en minúscula (eso es una opción de CO-1, no un enunciado). */
const RE_ANCLA_DESTINO_LISTA = /(?:^|\n)([A-J]|[|1])[.,)]\s+(?=\S)/g;

/** La columna "MENSAJES" de al lado, fundida por el OCR con el final del último enunciado: nunca es parte del enunciado. */
function quitarMensajesSueltos(texto: string): string {
  return texto.replace(/\s*(Mensaje\s+\d+\s*)+$/gi, "").trim();
}

function leerDestinosLista(texto: string, letras: readonly string[]): Destino[] {
  const bloques = trocearPorAnclas(texto, RE_ANCLA_DESTINO_LISTA)
    .map((b) => ({ letra: normalizarLetra(b.clave), titulo: "", texto: quitarMensajesSueltos(unaLinea(b.cuerpo)) }))
    .filter((b) => b.letra !== "");
  const porLetra = new Map(bloques.map((b) => [b.letra, b]));
  return letras.map((letra) => porLetra.get(letra) ?? { letra, titulo: "", texto: "" });
}

// ---------- la letra del ejemplo ----------

/**
 * El truco de la tabla de respuestas limpia que a veces acompaña al ejemplo
 * en la página de enfrente ("0. VERÓNICA E"): una fila que empieza por el "0."
 * del ejemplo y acaba en una letra suelta. El rótulo "Ejemplo" en sí no se
 * intenta leer nunca: va en una franja girada de la maqueta y el OCR lo
 * destroza siempre.
 */
function letraDelEjemploPorTabla(texto: string): string {
  const m = texto.match(/^0[.,]?\s+\S.*\s([A-J])\s*$/m);
  return m ? m[1] : "";
}

// ---------- lector ----------

/** Lee la tarea RELACIONAR (CE-1 o CO-2) a partir del texto OCR de sus páginas. */
export function leerRelacionar(texto: string, regla: ReglaTarea): FormularioDe<"RELACIONAR"> {
  const letras = letrasHasta(regla.letras);
  const consigna = dividirEnParrafos(texto)[0]?.join(" ") ?? "";
  const conTexto = regla.elementosConTexto ?? false;

  const { ejemplo: textoDelEjemplo, elementos } = conTexto
    ? leerElementosConTexto(texto, regla)
    : { ejemplo: "", elementos: elementosSinTexto(regla) };
  const destinos = conTexto ? leerDestinosDecorativos(texto, letras) : leerDestinosLista(texto, letras);
  // La tabla limpia manda si aparece; si no, la frase "opción correcta es la
  // X" que sí trae CO-2 (comun.ts). Ninguna de las dos se adivina: sin
  // ninguna pista, la letra se deja vacía.
  const letraEjemplo = letraDelEjemploPorTabla(texto) || letraDelEjemplo(texto);

  return {
    forma: "RELACIONAR",
    consigna,
    textos: ajustarLongitud([], regla.textos, () => ({ etiqueta: "", texto: "" })),
    medios: { imagenes: {}, audio: null },
    actividad: {
      ejemplo: { texto: textoDelEjemplo, letra: letraEjemplo },
      elementos,
      destinos,
    },
  };
}
