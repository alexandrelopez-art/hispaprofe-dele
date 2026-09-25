import { decode } from "jpeg-js";
import { PNG } from "pngjs";
import type { Hoja } from "@/lib/taller/ia/encargo";
import type { Lienzo } from "./imagen";

/**
 * Descodifica una `Hoja` almacenada a un `Lienzo` RGBA en memoria: lo que
 * necesitan `partirPorElLomo` y `detectarRotulosDePagina` para trabajar con
 * píxeles reales en vez de con la página entera (ver `etiquetar-solo.ts`).
 *
 * SOLO SERVIDOR: `jpeg-js` y `pngjs` son paquetes de Node y no existen en el
 * navegador, donde el propio `<canvas>` hace este mismo trabajo sin
 * librerías (ver `navegador.ts`). Nunca importar este archivo desde código
 * que pueda acabar en el bundle del cliente.
 *
 * `paginasDePdf` (pdf-en-navegador.ts) genera siempre JPEG de calidad 0,85,
 * así que es el formato de producción; PNG es el que usa el corpus de
 * pruebas de este taller. WEBP y GIF están en `TipoDeHoja` por si algún día
 * hace falta aceptarlos al subir, pero hoy no hay decodificador para ellos
 * aquí: mejor fallar con un mensaje claro que fingir un lienzo vacío.
 */
export function decodificarHoja(hoja: Hoja): Lienzo {
  switch (hoja.tipo) {
    case "image/jpeg":
      return decodificarComoJpeg(hoja.datos);
    case "image/png":
      return decodificarComoPng(hoja.datos);
    case "image/webp":
    case "image/gif":
      throw new Error(`Tipo de hoja "${hoja.tipo}" no se puede decodificar todavía: solo JPEG y PNG.`);
  }
}

function decodificarComoJpeg(base64: string): Lienzo {
  const { width, height, data } = decode(Buffer.from(base64, "base64"), { useTArray: true });
  return { ancho: width, alto: height, datos: Uint8ClampedArray.from(data) };
}

function decodificarComoPng(base64: string): Lienzo {
  const png = PNG.sync.read(Buffer.from(base64, "base64"));
  return { ancho: png.width, alto: png.height, datos: Uint8ClampedArray.from(png.data) };
}
