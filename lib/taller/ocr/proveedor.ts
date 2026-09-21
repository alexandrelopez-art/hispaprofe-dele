import type { Formulario } from "@/lib/taller/formas";
import type { ReglaTarea } from "@/lib/dele/estructura";
import { SIN_USO } from "@/lib/taller/ia/coste";
import { sinMedios, type Encargo, type Hoja } from "@/lib/taller/ia/encargo";
import type { LeerHojas, RespuestaDeLaIA } from "@/lib/taller/ia/llamar";
import { dudasDeOcr } from "./confianza";
import { leerHuecos } from "./formas/huecos";
import { leerListaComun } from "./formas/lista-comun";
import { leerOpciones } from "./formas/opciones";
import { leerOralDirecto, leerOralSolo } from "./formas/oral";
import { leerRedaccionDos, leerRedaccionUna } from "./formas/redaccion";
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
  const worker = await createWorker(IDIOMA);
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
 * Las hojas van enteras al OCR, sin recortar: las que llegan aquí ya vienen
 * etiquetadas para esta tarea, y los lectores de forma saben cortar por el
 * rótulo «TAREA N» cuando una hoja trae también la de al lado.
 */
export function crearLectorLocal(abrir: () => Promise<SesionDeLectura> = crearSesionDeLectura): LeerHojas {
  return async (encargo: Encargo): Promise<RespuestaDeLaIA> => {
    const sesion = await abrir();
    try {
      const textos: string[] = [];
      for (const hoja of encargo.hojas) textos.push(await sesion.reconocer(hoja));
      const formulario = leerSegunForma(textos.join("\n\n"), encargo.regla);
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
