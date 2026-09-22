// tests/ocr-rotulos.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Lienzo } from "@/lib/taller/ocr/imagen";
import {
  crearSesionOcr,
  detectarRotulosDePagina,
  extraerNumeroImpreso,
  interpretarRotulo,
  numeroDesdePalabras,
  type ReconocerTexto,
  type SesionOcr,
} from "@/lib/taller/ocr/rotulos";
import { partirPorElLomo } from "@/lib/taller/ocr/segmentar";

// El corpus vive fuera del repo (ver tests/ocr-segmentar.test.ts): si no está,
// las pruebas de OCR real se saltan solas. Las de más abajo (con OCR falso)
// no dependen de él y son las que mantienen la suite rápida.
const CARPETA_CORPUS = "/private/tmp/claude-501/-Users-pablo/8bb3590b-5e22-483c-a399-8015a4cf3aba/scratchpad/corpus";
const HAY_CORPUS = existsSync(path.join(CARPETA_CORPUS, "manifest.json"));

function paginaDelCorpus(archivo: string): Lienzo {
  const png = PNG.sync.read(readFileSync(path.join(CARPETA_CORPUS, archivo)));
  return { ancho: png.width, alto: png.height, datos: Uint8ClampedArray.from(png.data) };
}

// ---------- fixtures sintéticas (mismo estilo que ocr-segmentar.test.ts) ----------

function lienzoEnBlanco(ancho: number, alto: number): Lienzo {
  return { ancho, alto, datos: new Uint8ClampedArray(ancho * alto * 4).fill(255) };
}

function pintarRectangulo(lienzo: Lienzo, x0: number, x1: number, y0: number, y1: number, gris: number): Lienzo {
  const datos = Uint8ClampedArray.from(lienzo.datos);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (lienzo.ancho * y + x) * 4;
      datos[i] = gris;
      datos[i + 1] = gris;
      datos[i + 2] = gris;
      datos[i + 3] = 255;
    }
  }
  return { ...lienzo, datos };
}

const NEGRO = 0;
const GRIS_DE_BARRA = 130;
const ANCHO_SINTETICO = 200;
const ALTO_SINTETICO = 300;

/** Página sintética con cabecera, pie y dos reglas en el cuerpo (y=100 e y=200): las mismas que arma ocr-segmentar.test.ts. */
function lienzoDePagina(): Lienzo {
  const conCabecera = pintarRectangulo(lienzoEnBlanco(ANCHO_SINTETICO, ALTO_SINTETICO), 0, ANCHO_SINTETICO, 10, 17, GRIS_DE_BARRA);
  const conBandas = pintarRectangulo(conCabecera, 0, ANCHO_SINTETICO, ALTO_SINTETICO - 20, ALTO_SINTETICO - 10, GRIS_DE_BARRA);
  return [100, 200].reduce((l, y) => pintarRectangulo(l, 10, 190, y, y + 1, NEGRO), conBandas);
}

/** Un OCR falso que responde en el orden en que se le llama, tomando el siguiente texto de la lista. */
function reconocerDeCola(respuestas: readonly string[]): { reconocer: ReconocerTexto; llamadas: Lienzo[] } {
  const llamadas: Lienzo[] = [];
  const reconocer: ReconocerTexto = async (recorte) => {
    llamadas.push(recorte);
    return respuestas[llamadas.length - 1] ?? "";
  };
  return { reconocer, llamadas };
}

describe("interpretarRotulo", () => {
  it("reconoce un rótulo limpio sin variante", () => {
    expect(interpretarRotulo("TAREA 2\n", 0.5)).toEqual({ numero: 2, variante: null, y: 0.5 });
  });

  it("reconoce el número y la variante en un rótulo con sufijo OPCIÓN", () => {
    expect(interpretarRotulo("TAREA 1. DESCRIPCIÓN DE UNA FOTO (OPCIÓN 1)\n", 0.9)).toEqual({
      numero: 1,
      variante: "(OPCIÓN 1)",
      y: 0.9,
    });
  });

  it("tolera ruido del OCR entre TAREA y el número (espacios, punto pegado)", () => {
    expect(interpretarRotulo("TAREA   3.\n", 0.1)).toEqual({ numero: 3, variante: null, y: 0.1 });
  });

  it("no distingue mayúsculas de minúsculas", () => {
    expect(interpretarRotulo("tarea 4 diálogo en situación simulada (opción 2)", 0.2)).toEqual({
      numero: 4,
      variante: "(OPCIÓN 2)",
      y: 0.2,
    });
  });

  it("no confunde un número de OPCIÓN lejano con el número de la tarea", () => {
    expect(interpretarRotulo("TAREA 2. RUTA DEL BUEN COMER (OPCIÓN 1)", 0.5)).toEqual({
      numero: 2,
      variante: "(OPCIÓN 1)",
      y: 0.5,
    });
  });

  it("devuelve null cuando el texto no trae la palabra TAREA (borde de foto o de caja)", () => {
    const ruido = "Danecaleracenacaceceacecacaneaceaea cacao\nI<Za,aMFN]; EI;M:=-7TEE€-EEÉ.x.M\n";
    expect(interpretarRotulo(ruido, 0.5)).toBeNull();
  });

  it("devuelve null cuando TAREA aparece sin un número cerca (mención suelta de la palabra)", () => {
    expect(interpretarRotulo("Marca tus opciones en la Hoja de respuestas de esta tarea", 0.5)).toBeNull();
  });

  it("devuelve null con la cadena vacía", () => {
    expect(interpretarRotulo("", 0.5)).toBeNull();
  });
});

describe("numeroDesdePalabras", () => {
  it.each([
    ["cincuenta", 50],
    ["sesenta y cuatro", 64],
    ["sesenta y cinco", 65],
    ["ochenta y dos", 82],
    ["ciento treinta", 130],
    ["ciento treinta y uno", 131],
    ["ocho", 8],
    ["dieciséis", 16],
    ["veintidós", 22],
    ["cien", 100],
  ])("lee %s como %i", (texto, esperado) => {
    expect(numeroDesdePalabras(texto)).toBe(esperado);
  });

  it("no distingue mayúsculas ni depende de los acentos", () => {
    expect(numeroDesdePalabras("SESENTA Y CUATRO")).toBe(64);
    expect(numeroDesdePalabras("veintidos")).toBe(22);
  });

  it("devuelve null cuando el texto no es un número reconocible", () => {
    expect(numeroDesdePalabras("ruido sin sentido")).toBeNull();
  });

  it("devuelve null con la cadena vacía", () => {
    expect(numeroDesdePalabras("")).toBeNull();
  });
});

describe("extraerNumeroImpreso", () => {
  it("prefiere el dígito cuando el OCR sí lo conserva", () => {
    expect(extraerNumeroImpreso("64 - sesenta y cuatro")).toBe(64);
  });

  it("cae a las palabras cuando no hay dígito (lo habitual en este corpus)", () => {
    expect(extraerNumeroImpreso("sesenta y cuatro")).toBe(64);
  });

  it("devuelve null cuando ni el dígito ni las palabras se reconocen", () => {
    expect(extraerNumeroImpreso("NN EBEtema")).toBeNull();
  });
});

describe("detectarRotulosDePagina (con OCR falso, sin tesseract)", () => {
  it("filtra el falso positivo y se queda solo con el rótulo real, con la y normalizada", async () => {
    const lienzo = lienzoDePagina();
    const { reconocer } = reconocerDeCola(["TAREA 2", "ruido de borde de foto", "sesenta y cuatro"]);

    const resultado = await detectarRotulosDePagina(lienzo, reconocer);

    expect(resultado.inicios).toEqual([{ numero: 2, variante: null, y: 1 - 100 / ALTO_SINTETICO }]);
    expect(resultado.numeroImpreso).toBe(64);
  });

  it("conserva varios rótulos reales, en el orden en que aparecen en la página", async () => {
    const lienzo = lienzoDePagina();
    const { reconocer } = reconocerDeCola(["TAREA 1 (OPCIÓN 1)", "TAREA 1 (OPCIÓN 2)", "cuarenta y ocho"]);

    const resultado = await detectarRotulosDePagina(lienzo, reconocer);

    expect(resultado.inicios).toEqual([
      { numero: 1, variante: "(OPCIÓN 1)", y: 1 - 100 / ALTO_SINTETICO },
      { numero: 1, variante: "(OPCIÓN 2)", y: 1 - 200 / ALTO_SINTETICO },
    ]);
    expect(resultado.numeroImpreso).toBe(48);
  });

  it("no encuentra ningún rótulo cuando las dos candidatas son ruido (dos bordes de caja)", async () => {
    const lienzo = lienzoDePagina();
    const { reconocer } = reconocerDeCola(["ruido uno", "ruido dos", "cincuenta"]);

    const resultado = await detectarRotulosDePagina(lienzo, reconocer);

    expect(resultado.inicios).toEqual([]);
    expect(resultado.numeroImpreso).toBe(50);
  });

  it("deja el número de página en null cuando el pie no se lee, sin tocar los rótulos", async () => {
    const lienzo = lienzoDePagina();
    const { reconocer } = reconocerDeCola(["TAREA 3", "ruido", "NN EBEtema"]);

    const resultado = await detectarRotulosDePagina(lienzo, reconocer);

    expect(resultado.inicios).toEqual([{ numero: 3, variante: null, y: 1 - 100 / ALTO_SINTETICO }]);
    expect(resultado.numeroImpreso).toBeNull();
  });

  it("pasa exactamente una tira por regla candidata más una para el pie, nunca la página entera", async () => {
    const lienzo = lienzoDePagina();
    const { reconocer, llamadas } = reconocerDeCola(["TAREA 1", "ruido", "cincuenta"]);

    await detectarRotulosDePagina(lienzo, reconocer);

    expect(llamadas).toHaveLength(3);
    for (const tira of llamadas) {
      expect(tira.alto).toBeLessThan(lienzo.alto);
      expect(tira.ancho).toBe(lienzo.ancho);
    }
  });
});

describe.skipIf(!HAY_CORPUS)("detectarRotulosDePagina con tesseract.js real, contra el corpus (lento)", () => {
  let sesion: SesionOcr;

  beforeAll(async () => {
    sesion = await crearSesionOcr();
  }, 60_000);

  afterAll(async () => {
    await sesion.cerrar();
  });

  it(
    "en e1_p03 (página suelta) encuentra solo TAREA 2 y descarta los dos bordes de caja, y lee la página 50",
    async () => {
      const lienzo = paginaDelCorpus("e1_p03.png");
      const resultado = await detectarRotulosDePagina(lienzo, sesion.reconocerRotulo);

      expect(resultado.inicios).toHaveLength(1);
      expect(resultado.inicios[0].numero).toBe(2);
      expect(resultado.inicios[0].variante).toBeNull();
      expect(resultado.numeroImpreso).toBe(50);
    },
    30_000,
  );

  it(
    "en e2_p02 (doble página) lee 64 a la izquierda y 65 a la derecha, cada una con su rótulo",
    async () => {
      const lienzo = paginaDelCorpus("e2_p02.png");
      const [izquierda, derecha] = partirPorElLomo(lienzo);

      const resultadoIzquierda = await detectarRotulosDePagina(izquierda, sesion.reconocerRotulo);
      const resultadoDerecha = await detectarRotulosDePagina(derecha, sesion.reconocerRotulo);

      expect(resultadoIzquierda.numeroImpreso).toBe(64);
      expect(resultadoIzquierda.inicios.map((m) => m.numero)).toEqual([2]);

      expect(resultadoDerecha.numeroImpreso).toBe(65);
      expect(resultadoDerecha.inicios.map((m) => m.numero)).toEqual([3]);
    },
    30_000,
  );
});
