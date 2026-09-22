import { tmpdir } from "node:os";

import type { Formulario } from "@/lib/taller/formas";
import { NOMBRE_DE_PRUEBA, type ReglaTarea } from "@/lib/dele/estructura";
import { SIN_USO } from "@/lib/taller/ia/coste";
import { sinMedios, type Encargo, type Hoja } from "@/lib/taller/ia/encargo";
import type { LeerHojas, RespuestaDeLaIA } from "@/lib/taller/ia/llamar";
import { dudasDeOcr } from "./confianza";
import { leerHuecos } from "./formas/huecos";
import { leerListaComun } from "./formas/lista-comun";
import { leerOpciones } from "./formas/opciones";
import { leerOralDirecto, leerOralSolo } from "./formas/oral";
// `extraerBloquesDeTarea` vive en redaccion.ts pero no es suyo: corta por
// el rotulo "TAREA N", que es igual en las ocho formas.
import { extraerBloquesDeTarea, leerRedaccionDos, leerRedaccionUna } from "./formas/redaccion";
import { leerRelacionar } from "./formas/relacionar";

/** Lo que se apunta como «modelo» en LlamadaDeIA cuando lee el lector local: no hay modelo, pero la columna no admite vacío. */
export const MODELO_LOCAL = "tesseract-spa";

const IDIOMA = "spa";

/**
 * Modo de segmentación de página. Hace falta el automático y no el que trae
 * tesseract.js de serie: el de serie trata la hoja como un bloque único y no
 * deja una línea en blanco entre párrafos, y sin esas líneas los lectores
 * que se guían por ellas (huecos, lista común, redacción, oral) se quedan
 * casi a cero. Medido: la tarea de huecos pasaba de 21 campos a 2.
 */
const SEGMENTACION_AUTOMATICA = "3";

export type ReconocerHoja = (hoja: Hoja) => Promise<string>;

/** Un lector de hojas vivo. `cerrar` mata el worker de WebAssembly: sin eso el proceso no termina. */
export type SesionDeLectura = { reconocer: ReconocerHoja; cerrar: () => Promise<void> };

export async function crearSesionDeLectura(): Promise<SesionDeLectura> {
  const { createWorker } = await import("tesseract.js");
  // Sin `cachePath` tesseract.js deja los 3,3 MB del idioma en el directorio
  // de trabajo: basura en el repo al probar y, en un servidor de solo
  // lectura, un fallo al arrancar.
  const worker = await createWorker(IDIOMA, undefined, { cachePath: tmpdir() });
  await worker.setParameters({ tessedit_pageseg_mode: SEGMENTACION_AUTOMATICA as never });
  return {
    // tesseract.js decodifica el JPEG él solo, así que la hoja va tal cual
    // llega del almacén y aquí no hace falta ningún decodificador de imagen.
    reconocer: async (hoja) => (await worker.recognize(Buffer.from(hoja.datos, "base64"))).data.text,
    cerrar: async () => {
      await worker.terminate();
    },
  };
}

/**
 * Recorta el texto a lo que es de esta tarea y nada más.
 *
 * Una hoja etiquetada para la tarea 4 trae también la cabecera de la página
 * ("PRUEBA DE COMPRENSIÓN DE LECTURA") y, muchas veces, el final de la
 * tarea anterior: 48 de las 84 caras del corpus llevan más de una tarea.
 * Sin recortar, la consigna de la tarea 4 salía como "E LECTURA" y la de la
 * tarea 3 se llevaba el texto de lectura entero.
 *
 * Si el OCR no encontró ningún rótulo, `extraerBloquesDeTarea` devuelve el
 * texto tal cual: es mejor leer de más que quedarse sin nada que leer.
 */
function soloEstaTarea(texto: string, regla: ReglaTarea): string {
  return extraerBloquesDeTarea(texto, regla.numero).map(sinCabeceraSuelta).join("\n\n");
}

/** Las cabeceras completas de las que el OCR deja trozos sueltos por el medio del bloque. */
const CABECERAS = Object.values(NOMBRE_DE_PRUEBA).map((n) => `PRUEBA DE ${n.toUpperCase()}`);

/** Un trozo más corto que esto ("DE", "LA") aparece en prosa de verdad y no se toca. */
const MINIMO_DE_TROZO = 5;

/**
 * Quita las líneas que son un pedazo del rótulo gris de la página.
 *
 * El rótulo ("PRUEBA DE COMPRENSIÓN DE LECTURA") va en versalitas a la
 * derecha y el OCR lo parte y lo deja caer dentro del bloque: en la tarea 4
 * del examen 2 cae un "E LECTURA" justo después de "Instrucciones", y los
 * lectores lo tomaban por la consigna. No vale con mirar solo la cabecera de
 * la página porque el trozo aparece en medio del texto.
 */
function sinCabeceraSuelta(bloque: string): string {
  return bloque
    .split(/\r?\n/)
    .filter((linea) => {
      const limpia = linea.trim().toUpperCase().replace(/\s+/g, " ");
      if (limpia.length < MINIMO_DE_TROZO) return true;
      return !CABECERAS.some((cabecera) => cabecera.includes(limpia));
    })
    .join("\n");
}

function leerSegunForma(texto: string, regla: ReglaTarea): Formulario {
  switch (regla.forma) {
    case "RELACIONAR":
      return leerRelacionar(texto, regla);
    case "LISTA_COMUN":
      return leerListaComun(texto, regla);
    case "OPCIONES":
      return leerOpciones(texto, regla);
    case "HUECOS":
      return leerHuecos(texto, regla);
    case "REDACCION_UNA":
      return leerRedaccionUna(texto, regla);
    case "REDACCION_DOS":
      return leerRedaccionDos(texto, regla);
    case "ORAL_SOLO":
      return leerOralSolo(texto, regla);
    case "ORAL_DIRECTO":
      return leerOralDirecto(texto, regla);
  }
}

/**
 * Lee las hojas de una tarea sin salir de la máquina. Devuelve lo mismo que
 * `leerConClaude` para que `interpretar()` valide las dos por el mismo sitio.
 *
 * La hoja va entera al OCR, sin recortar la imagen: las que llegan aquí ya
 * vienen etiquetadas para esta tarea. Lo que sí se recorta es el texto de
 * vuelta, que trae cabeceras de página y tareas vecinas (ver `soloEstaTarea`).
 */
export function crearLectorLocal(abrir: () => Promise<SesionDeLectura> = crearSesionDeLectura): LeerHojas {
  return async (encargo: Encargo): Promise<RespuestaDeLaIA> => {
    const sesion = await abrir();
    try {
      const textos: string[] = [];
      for (const hoja of encargo.hojas) textos.push(await sesion.reconocer(hoja));
      const formulario = leerSegunForma(soloEstaTarea(textos.join("\n\n"), encargo.regla), encargo.regla);
      return {
        salida: {
          formulario: sinMedios(formulario),
          // `interpretar` valida lo que llega con el mismo esquema que se le
          // pide a Claude, y ahí la duda se llama «campo»; la `Duda` de casa
          // lo llama «clave». La traducción va aquí, que es la frontera.
          dudas: dudasDeOcr(formulario).map((d) => ({ campo: d.clave, nota: d.nota })),
        },
        stopReason: "end_turn",
        modelo: MODELO_LOCAL,
        uso: SIN_USO,
      };
    } finally {
      await sesion.cerrar();
    }
  };
}
