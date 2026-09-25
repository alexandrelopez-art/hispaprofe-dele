import { encode } from "jpeg-js";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import type { Hoja } from "@/lib/taller/ia/encargo";
import { decodificarHoja } from "@/lib/taller/ocr/decodificar";

const ANCHO = 4;
const ALTO = 3;

/** Un patrón simple y determinista: cada píxel un gris distinto, para poder comparar tras decodificar. */
function datosDePrueba(): Uint8ClampedArray {
  const datos = new Uint8ClampedArray(ANCHO * ALTO * 4);
  for (let i = 0; i < ANCHO * ALTO; i++) {
    const gris = (i * 37) % 256;
    datos[i * 4] = gris;
    datos[i * 4 + 1] = gris;
    datos[i * 4 + 2] = gris;
    datos[i * 4 + 3] = 255;
  }
  return datos;
}

describe("decodificarHoja", () => {
  it("decodifica un PNG (el formato del corpus de pruebas) a un lienzo con las mismas dimensiones y píxeles", () => {
    const datos = datosDePrueba();
    const png = new PNG({ width: ANCHO, height: ALTO });
    Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength).copy(png.data);
    const hoja: Hoja = { datos: PNG.sync.write(png).toString("base64"), tipo: "image/png" };

    const lienzo = decodificarHoja(hoja);

    expect(lienzo.ancho).toBe(ANCHO);
    expect(lienzo.alto).toBe(ALTO);
    expect(Array.from(lienzo.datos)).toEqual(Array.from(datos));
  });

  it("decodifica un JPEG (el formato que genera paginasDePdf en producción) a un lienzo con las dimensiones correctas", () => {
    const datos = datosDePrueba();
    const bytes = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
    const jpeg = encode({ width: ANCHO, height: ALTO, data: bytes }, 100);
    const hoja: Hoja = { datos: jpeg.data.toString("base64"), tipo: "image/jpeg" };

    const lienzo = decodificarHoja(hoja);

    expect(lienzo.ancho).toBe(ANCHO);
    expect(lienzo.alto).toBe(ALTO);
    // JPEG es con pérdida: no se compara píxel a píxel, solo que decodifica al tamaño correcto en RGBA.
    expect(lienzo.datos.length).toBe(ANCHO * ALTO * 4);
  });

  it("lanza un error claro para un tipo de imagen que todavía no sabe decodificar", () => {
    const hoja: Hoja = { datos: "", tipo: "image/webp" };
    expect(() => decodificarHoja(hoja)).toThrow(/no se puede decodificar/i);
  });

  it("no revienta con un error críptico ante bytes que no son una imagen válida: lo que lanza el decodificador subyacente sube tal cual", () => {
    const hoja: Hoja = { datos: Buffer.from("esto no es un png").toString("base64"), tipo: "image/png" };
    expect(() => decodificarHoja(hoja)).toThrow();
  });
});
