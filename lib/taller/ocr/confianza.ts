import type { Ruta } from "@/lib/taller/editar";
import type { Duda } from "@/lib/taller/ia/dudas";
import { claveDeRuta } from "@/lib/taller/ia/dudas";
import type { Formulario } from "@/lib/taller/formas";

/**
 * La capa de seguridad del lector de OCR: donde la IA se autodenuncia con
 * `dudas` cuando no está segura, el OCR local no tiene esa autoconciencia.
 * Este módulo la simula mirando el `Formulario` ya relleno (y, si se le da,
 * la confianza de tesseract) y devolviendo las mismas `Duda[]` que ya sabe
 * pintar la pantalla de revisión. Tres señales, de la más a la menos grave:
 *
 *   1. Un campo de texto vacío donde el OCR debería haber escrito algo: la
 *      pérdida silenciosa de contenido (ver el fixture real de CE-2 en
 *      tests/ayudas/ocr-formas/ce2-lista-comun.txt, cuya sexta pregunta
 *      llega partida en dos fragmentos y se descarta entera).
 *   2. Un campo cuyo texto viene de palabras con poca confianza media de
 *      tesseract (0-100).
 *   3. Un campo cuyo texto tiene la huella de una marca de opción mal leída
 *      y pegada al contenido, aunque la confianza sea alta.
 *
 * Se prefiere el falso positivo al falso negativo: una duda de más le cuesta
 * al profesor dos segundos de repasar un campo bueno; una duda que falta
 * publica un examen roto.
 */

/**
 * La confianza media (escala de tesseract, 0-100) de las palabras que
 * dieron el texto de un campo, indexada por la misma clave con puntos que
 * usa `claveDeRuta` (p. ej. "actividad.preguntas.5.enunciado"). Así un
 * lector de OCR que quiera aportar esta señal solo tiene que ir anotando,
 * campo a campo, la confianza media de las palabras que le dieron el texto;
 * si no aporta nada para un campo, ese campo simplemente no se juzga por
 * confianza (solo por vacío y por corrupción).
 */
export type ConfianzaPorCampo = ReadonlyMap<string, number>;

/**
 * Medido contra el corpus: la confianza media de una tira ronda 93-94 %.
 * Un campo que cae bastante por debajo de eso, y no solo el ruido normal
 * alrededor de la media, es la señal de una región genuinamente mala. Un
 * umbral pegado a la media haría que casi cualquier campo se marcara
 * (ruido normal), lo que apaga la utilidad de la lista de dudas.
 */
const UMBRAL_CONFIANZA_BAJA = 80;

/** Letras que tesseract confunde con la marca de opción corrupta (igual que `RE_MARCA_SIN_PUNTUACION` en ocr/formas/comun.ts). */
const LETRAS_DE_MARCA = "ABCDEOQ";

/**
 * Palabras españolas cortas que una marca corrupta puede dejar pegadas al
 * arrancar una frase (p. ej. la "C)" del corpus real, leída como "Q", pegada
 * a "si" → "Qsi"). Duplica a propósito `PALABRAS_CORTAS_COMUNES` de
 * ocr/formas/comun.ts: esa función resuelve el problema contrario (separar
 * la marca del contenido durante el troceo) y ese fichero no la exporta;
 * como esta carpeta está vetada para editar aquí, se repite la lista en vez
 * de tocarlo.
 */
const PALABRAS_CORTAS_COMUNES = new Set([
  "o", "y", "u", "a", "e", "el", "la", "lo", "un", "no", "ya", "su", "de", "en",
  "es", "ha", "he", "tu", "mi", "si", "va", "ve", "da", "ir", "al", "le", "me", "te",
]);

/** Vocales españolas (con tilde y diéresis) para detectar rachas de consonantes imposibles en español. */
const VOCALES = "AEIOUÁÉÍÓÚÜaeiouáéíóúü";

/** Ninguna palabra española tiene una racha así de larga sin vocales: es señal de letras mal leídas, no de un texto real. */
const LARGO_MINIMO_CONSONANTES_SEGUIDAS = 5;

const NOTA_VACIO = "Este campo se ha quedado vacío: comprueba la hoja original y complétalo si falta contenido.";

function notaDeConfianzaBaja(confianza: number): string {
  return `El OCR leyó este texto con poca confianza (${Math.round(confianza)} %): contrástalo con la hoja original antes de dar la tarea por buena.`;
}

function notaDeMarcaPegada(palabra: string): string {
  return `Este texto podría llevar pegada una marca de opción mal leída, junto a «${palabra}»: compáralo con la hoja original.`;
}

function notaDeLetraSuelta(palabra: string): string {
  return `La letra suelta «${palabra}» en este texto podría ser el resto de una marca de opción: compáralo con la hoja original.`;
}

function notaDeMezclaImplausible(palabra: string): string {
  return `La palabra «${palabra}» tiene una combinación de letras poco habitual en español: compárala con la hoja original.`;
}

/** Una hoja de texto del formulario: su ruta (para el `campo` de la duda) y el valor que trae. */
type HojaDeTexto = { ruta: Ruta; texto: string };

/**
 * Claves que nunca son contenido de OCR y por tanto no se recorren:
 * `forma` es el discriminante del esquema; `letra` la pone siempre
 * `imponerEstructura` a partir de la regla, nunca el OCR (ver el comentario
 * de cabecera de ocr/formas/comun.ts); `medios` son referencias a ficheros
 * (fotos y audio), no texto, y ya las vigila `estado.ts`.
 */
const CLAVES_SIN_CONTENIDO_OCR = new Set(["forma", "letra", "medios"]);

/**
 * En RELACIONAR, el texto de cada elemento y del ejemplo solo existe cuando
 * la regla trae `elementosConTexto: true` (p. ej. CE-1); en tareas como
 * CO-2 ("Mensaje 1-6") se deja vacío a propósito y nunca se rellena. Esta
 * función no recibe la regla, así que no puede distinguir los dos casos: se
 * excluye del recorrido para no marcar como vacía una tarea que está
 * completa. (La falta real, si la hay, la sigue cazando `motivosDeTarea` en
 * estado.ts, que sí conoce la regla — a costa de perder el resaltado por
 * campo que da esta capa.)
 */
function esTextoDeElementoRelacionar(ruta: Ruta): boolean {
  if (ruta.length === 4 && ruta[0] === "actividad" && ruta[1] === "elementos" && ruta[3] === "texto") return true;
  return ruta.length === 3 && ruta[0] === "actividad" && ruta[1] === "ejemplo" && ruta[2] === "texto";
}

/** Recoge todas las hojas de texto del formulario, sin mutar nada de lo que recibe. */
function recolectarHojasDeTexto(valor: unknown, ruta: Ruta): HojaDeTexto[] {
  if (typeof valor === "string") return [{ ruta, texto: valor }];
  if (Array.isArray(valor)) return valor.flatMap((elemento, indice) => recolectarHojasDeTexto(elemento, [...ruta, indice]));
  if (valor === null || typeof valor !== "object") return [];

  const objeto = valor as Record<string, unknown>;
  // Una opción con imagen no tiene texto que leer: su "texto" nunca es contenido, es una foto.
  const sinTextoPorImagen = objeto.conImagen === true;
  return Object.entries(objeto).flatMap(([clave, hijo]) => {
    if (CLAVES_SIN_CONTENIDO_OCR.has(clave)) return [];
    if (clave === "texto" && sinTextoPorImagen) return [];
    return recolectarHojasDeTexto(hijo, [...ruta, clave]);
  });
}

/** Las palabras (solo letras, con tildes y eñe) de un texto, en su forma original. */
function extraerPalabras(texto: string): string[] {
  return texto.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [];
}

/**
 * Una marca de opción corrupta (una letra confundible en mayúscula) pegada
 * sin espacio a una palabra española corta: el fingerprint del "Qsi" real
 * del corpus ("C)" leído como "Q", pegado a "si"). Se exige el resto en
 * minúsculas y corto (2-4 letras en total) para no atrapar palabras
 * normales con mayúscula inicial larga ("Como", "Donde"...). Solo se aplica
 * en campos de opción con letra (`esTextoDeItemConLetra`): son los únicos
 * que de verdad llevan una marca delante en el cuadernillo, y limitarlo así
 * evita disparar en prosa suelta sobre palabras reales que empiezan por
 * A/E/O (frecuentes por ser también conjunciones/preposiciones sueltas).
 */
function esMarcaPegadaAPalabraCorta(palabra: string): boolean {
  if (palabra.length < 3 || palabra.length > 4) return false;
  if (!LETRAS_DE_MARCA.includes(palabra[0])) return false;
  const resto = palabra.slice(1);
  if (resto !== resto.toLowerCase()) return false;
  return PALABRAS_CORTAS_COMUNES.has(resto.toLowerCase());
}

/**
 * Una letra suelta, ella sola como ficha, de las que tesseract confunde con
 * la marca de opción: el resto de una marca que perdió su contenido. "A",
 * "E" y "O" quedan fuera aunque estén en `LETRAS_DE_MARCA`: son también
 * preposiciones/conjunciones españolas de una sola letra, y en mayúscula al
 * empezar una frase son perfectamente normales (p. ej. "A los 22 años...",
 * caso real del corpus). Solo B, C, D y Q sueltas no son nunca una palabra.
 */
function esLetraDeMarcaSuelta(palabra: string): boolean {
  if (palabra.length !== 1 || !LETRAS_DE_MARCA.includes(palabra)) return false;
  return !PALABRAS_CORTAS_COMUNES.has(palabra.toLowerCase());
}

/**
 * La consigna: comprobado contra el corpus real, casi todas dicen algo como
 * "Selecciona la opción correcta (A, B o C)" — nombran las letras de las
 * opciones a propósito, como parte de las instrucciones, no como contenido
 * leído. Sin esta excepción, la letra suelta de esa frase dispara en casi
 * cualquier tarea real. La consigna es además texto de plantilla del propio
 * libro, mucho más estable frente al OCR que el contenido libre, así que el
 * coste de no vigilar aquí esta huella concreta es bajo.
 */
function esConsigna(ruta: Ruta): boolean {
  return ruta.length === 1 && ruta[0] === "consigna";
}

/**
 * Un campo de un ítem con letra propia (una opción, un común, un destino):
 * el único sitio del cuadernillo donde el texto viene precedido de una
 * marca como "A)" o "C)" y por tanto el único donde tiene sentido buscar
 * los restos de una marca pegada al principio.
 */
function esTextoDeItemConLetra(ruta: Ruta): boolean {
  const ultimaClave = ruta.at(-1);
  const indice = ruta.at(-2);
  const claveDeLista = ruta.at(-3);
  if (ultimaClave !== "texto" || typeof indice !== "number") return false;
  return claveDeLista === "opciones" || claveDeLista === "comunes" || claveDeLista === "destinos";
}

/** Una ficha (letras o dígitos) con dígitos y letras mezclados: el español no escribe así, es una confusión típica de OCR (0/O, 1/l, 5/S...). */
function tieneDigitoYLetra(ficha: string): boolean {
  return /[0-9]/.test(ficha) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ficha);
}

/** Una racha de consonantes seguidas más larga que ninguna palabra española real. */
function tieneRachaDeConsonantes(palabra: string): boolean {
  const re = new RegExp(`[^${VOCALES}]{${LARGO_MINIMO_CONSONANTES_SEGUIDAS},}`);
  return re.test(palabra);
}

/** La primera señal de corrupción que encuentra en `texto`, o `null` si no hay ninguna. */
function notaDeCorrupcion(texto: string, ruta: Ruta): string | null {
  const palabras = extraerPalabras(texto);
  if (esTextoDeItemConLetra(ruta)) {
    const marcaPegada = palabras.find(esMarcaPegadaAPalabraCorta);
    if (marcaPegada) return notaDeMarcaPegada(marcaPegada);
  }
  if (!esConsigna(ruta)) {
    const letraSuelta = palabras.find(esLetraDeMarcaSuelta);
    if (letraSuelta) return notaDeLetraSuelta(letraSuelta);
  }

  const fichas = texto.match(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [];
  const mezcla = fichas.find(tieneDigitoYLetra) ?? palabras.find(tieneRachaDeConsonantes);
  if (mezcla) return notaDeMezclaImplausible(mezcla);

  return null;
}

/**
 * Las dudas que un lector de OCR no puede autodenunciar: campos vacíos que
 * deberían llevar contenido, campos leídos con poca confianza y campos con
 * huellas de corrupción de OCR. No repite lo que ya calcula `estado.ts`
 * (huecos de foto o audio, o si el formulario cuadra con la regla): esto es
 * solo sobre el TEXTO que el OCR puso, o no puso, en cada campo.
 */
export function dudasDeOcr(formulario: Formulario, confianzaPorCampo: ConfianzaPorCampo = new Map()): Duda[] {
  const hojas = recolectarHojasDeTexto(formulario, []);
  const notasPorClave = new Map<string, string[]>();
  const anotar = (ruta: Ruta, nota: string): void => {
    const clave = claveDeRuta(ruta);
    notasPorClave.set(clave, [...(notasPorClave.get(clave) ?? []), nota]);
  };

  for (const hoja of hojas) {
    if (hoja.texto.trim() === "") {
      if (!esTextoDeElementoRelacionar(hoja.ruta)) anotar(hoja.ruta, NOTA_VACIO);
      continue; // vacío: no tiene sentido juzgar la confianza ni la corrupción de la nada
    }

    const confianza = confianzaPorCampo.get(claveDeRuta(hoja.ruta));
    if (confianza !== undefined && confianza < UMBRAL_CONFIANZA_BAJA) anotar(hoja.ruta, notaDeConfianzaBaja(confianza));

    const corrupcion = notaDeCorrupcion(hoja.texto, hoja.ruta);
    if (corrupcion) anotar(hoja.ruta, corrupcion);
  }

  return [...notasPorClave.entries()].map(([clave, notas]) => ({ clave, nota: notas.join(" · ") }));
}
