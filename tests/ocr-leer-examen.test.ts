// tests/ocr-leer-examen.test.ts
//
// leer-examen.ts es el ensamblador final: encadena segmentación, rótulos,
// orden/etiquetado y los ocho lectores de forma. Las pruebas rápidas de más
// abajo cubren la parte que de verdad puede salir mal (el troceo vertical de
// una tarea, que puede correr por varias hojas) con datos de mentira; la
// última, guardada tras `HAY_CORPUS`, corre el pipeline completo contra un
// examen real con tesseract.js de verdad.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import type { MarcaDeInicio } from "@/lib/taller/etiquetas-automaticas";
import { formularioVacio } from "@/lib/taller/formas";
import type { Lienzo } from "@/lib/taller/ocr/imagen";
import {
  dividirEnHojas,
  eventosDeHoja,
  leerExamen,
  partirEtiqueta,
  pixelYDeMarca,
  regionesDelTramo,
  type EventoDeApertura,
  type HojaDelExamen,
} from "@/lib/taller/ocr/leer-examen";
import { crearSesionOcr, type ReconocerTexto, type SesionOcr } from "@/lib/taller/ocr/rotulos";

const NIVEL = "A2_B1_ESCOLAR";
const CARPETA_CORPUS = "/private/tmp/claude-501/-Users-pablo/8bb3590b-5e22-483c-a399-8015a4cf3aba/scratchpad/corpus";
const HAY_CORPUS = existsSync(path.join(CARPETA_CORPUS, "manifest.json"));

// ---------- fixtures sintéticas (mismo estilo que ocr-segmentar.test.ts / ocr-rotulos.test.ts) ----------

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
const ANCHO = 200;
const ALTO = 300;

/** Una hoja realista: banda de cabecera, de pie, y como mucho una raya de tarea en `yRegla` (o ninguna si es null). */
function hojaSintetica(yRegla: number | null): Lienzo {
  const conCabecera = pintarRectangulo(lienzoEnBlanco(ANCHO, ALTO), 0, ANCHO, 10, 17, GRIS_DE_BARRA);
  const conBandas = pintarRectangulo(conCabecera, 0, ANCHO, ALTO - 20, ALTO - 10, GRIS_DE_BARRA);
  return yRegla === null ? conBandas : pintarRectangulo(conBandas, 10, 190, yRegla, yRegla + 1, NEGRO);
}

function hoja(indicePdf: number, lienzo: Lienzo): HojaDelExamen {
  return { indicePdf, lado: null, lienzo };
}

/** Un OCR falso que responde en el orden en que se le llama; una entrada puede ser un error para simular un fallo real de OCR. */
function reconocerDeCola(respuestas: readonly (string | Error)[]): ReconocerTexto {
  let i = 0;
  return async () => {
    const r = respuestas[i] ?? "";
    i++;
    if (r instanceof Error) throw r;
    return r;
  };
}

// ---------- pixelYDeMarca / partirEtiqueta ----------

describe("pixelYDeMarca", () => {
  it("invierte exactamente la normalización que hace rotulos.ts (y=1 arriba, y=0 abajo)", () => {
    expect(pixelYDeMarca({ numero: 1, variante: null, y: 1 - 100 / 300 }, 300)).toBe(100);
    expect(pixelYDeMarca({ numero: 1, variante: null, y: 1 }, 300)).toBe(0);
    expect(pixelYDeMarca({ numero: 1, variante: null, y: 0 }, 300)).toBe(300);
  });
});

describe("partirEtiqueta", () => {
  it("separa prueba y número", () => {
    expect(partirEtiqueta("CE-2")).toEqual({ prueba: "CE", numero: 2 });
    expect(partirEtiqueta("EO-4")).toEqual({ prueba: "EO", numero: 4 });
  });

  it("lanza si la etiqueta no es de una prueba conocida (no debería pasar con etiquetas de etiquetasDeNivel)", () => {
    expect(() => partirEtiqueta("XX-1")).toThrow();
  });
});

// ---------- eventosDeHoja: el corazón del troceo ----------

describe("eventosDeHoja", () => {
  const lienzo = hojaSintetica(null); // solo hace falta para bandasDePagina (cabecera=17)

  it("una hoja sin heredar (primer rótulo) produce un único evento en la marca, sin evento de cabecera", () => {
    const marca: MarcaDeInicio = { numero: 1, variante: null, y: 1 - 100 / ALTO };
    expect(eventosDeHoja(["CE-1"], [marca], lienzo)).toEqual([{ etiquetas: ["CE-1"], y: 100 }]);
  });

  it("una hoja que solo continúa (sin rótulo propio) hereda desde la cabecera", () => {
    expect(eventosDeHoja(["CE-2"], [], lienzo)).toEqual([{ etiquetas: ["CE-2"], y: 17 }]);
  });

  it("hereda la tarea anterior y abre la nueva en su rótulo, en el mismo orden que trae `etiquetas`", () => {
    const marca: MarcaDeInicio = { numero: 2, variante: null, y: 1 - 80 / ALTO };
    expect(eventosDeHoja(["CE-1", "CE-2"], [marca], lienzo)).toEqual([
      { etiquetas: ["CE-1"], y: 17 },
      { etiquetas: ["CE-2"], y: 80 },
    ]);
  });

  it("dos etiquetas heredadas a la vez (reencuentro de una pareja oral) comparten el mismo evento y la misma y", () => {
    // EO-1 y EO-3 ya se confirmaron antes; esta hoja solo trae el rótulo de EO-4.
    const marca: MarcaDeInicio = { numero: 4, variante: null, y: 1 - 120 / ALTO };
    expect(eventosDeHoja(["EO-1", "EO-3", "EO-4"], [marca], lienzo)).toEqual([
      { etiquetas: ["EO-1", "EO-3"], y: 17 },
      { etiquetas: ["EO-4"], y: 120 },
    ]);
  });

  it("no deja que un número repetido entre pruebas (CE-1/CO-1) case el rótulo equivocado con lo heredado", () => {
    // Un único rótulo en la hoja, numero=1, que es el de CO-1 (la nueva), no el de CE-1 (lo heredado).
    const marca: MarcaDeInicio = { numero: 1, variante: null, y: 1 - 90 / ALTO };
    expect(eventosDeHoja(["CE-4", "CO-1"], [marca], lienzo)).toEqual([
      { etiquetas: ["CE-4"], y: 17 }, // heredado: no se le cuela el rótulo de CO-1 solo porque comparten el "1"
      { etiquetas: ["CO-1"], y: 90 },
    ]);
  });
});

// ---------- regionesDelTramo: los tramos a OCR, nunca una hoja entera de golpe ----------

describe("regionesDelTramo", () => {
  const hojas: HojaDelExamen[] = [hoja(0, hojaSintetica(null)), hoja(1, hojaSintetica(null)), hoja(2, hojaSintetica(null))];

  it("dos eventos en la misma hoja: un único tramo, recortado antes del rótulo siguiente por el margen", () => {
    const actual: EventoDeApertura = { hojaIndice: 0, y: 100, etiquetas: ["CE-1"] };
    const siguiente: EventoDeApertura = { hojaIndice: 0, y: 200, etiquetas: ["CE-2"] };
    expect(regionesDelTramo(actual, siguiente, hojas)).toEqual([{ hojaIndice: 0, y0: 100, y1: 150 }]); // 200 - 50 de margen
  });

  it("evento seguido de cerca (menos que el margen) nunca produce un tramo de alto negativo", () => {
    const actual: EventoDeApertura = { hojaIndice: 0, y: 100, etiquetas: ["CE-1"] };
    const siguiente: EventoDeApertura = { hojaIndice: 0, y: 110, etiquetas: ["CE-2"] };
    const regiones = regionesDelTramo(actual, siguiente, hojas);
    for (const r of regiones) expect(r.y1).toBeGreaterThan(r.y0);
  });

  it("el siguiente evento cae dos hojas más adelante: recorta el resto de la primera, la del medio entera y el principio de la última", () => {
    const actual: EventoDeApertura = { hojaIndice: 0, y: 100, etiquetas: ["CE-2"] };
    const siguiente: EventoDeApertura = { hojaIndice: 2, y: 90, etiquetas: ["CE-3"] };
    expect(regionesDelTramo(actual, siguiente, hojas)).toEqual([
      { hojaIndice: 0, y0: 100, y1: 280 }, // hasta el pie de su propia hoja
      { hojaIndice: 1, y0: 17, y1: 280 }, // la hoja del medio, entera (cabecera a pie), nunca de borde a borde
      { hojaIndice: 2, y0: 17, y1: 40 }, // 90 - 50 de margen, desde la cabecera
    ]);
  });

  it("sin evento siguiente (última tarea del examen): llega hasta el pie de la última hoja, sin recortar margen", () => {
    const actual: EventoDeApertura = { hojaIndice: 1, y: 50, etiquetas: ["EO-4"] };
    expect(regionesDelTramo(actual, null, hojas)).toEqual([
      { hojaIndice: 1, y0: 50, y1: 280 },
      { hojaIndice: 2, y0: 17, y1: 280 },
    ]);
  });
});

// ---------- dividirEnHojas ----------

describe("dividirEnHojas", () => {
  it("una página vertical (single) no se parte: una sola hoja, lado null", () => {
    const paginas = [lienzoEnBlanco(100, 150)];
    const hojas = dividirEnHojas(paginas);
    expect(hojas).toEqual([{ indicePdf: 0, lado: null, lienzo: paginas[0] }]);
  });

  it("una doble página (spread) se parte en dos hojas con el mismo indicePdf", () => {
    const paginas = [lienzoEnBlanco(300, 200)];
    const hojas = dividirEnHojas(paginas);
    expect(hojas).toHaveLength(2);
    expect(hojas[0]).toMatchObject({ indicePdf: 0, lado: "izquierda" });
    expect(hojas[1]).toMatchObject({ indicePdf: 0, lado: "derecha" });
  });

  it("varias páginas de entrada conservan su indicePdf en orden", () => {
    const paginas = [lienzoEnBlanco(100, 150), lienzoEnBlanco(300, 200), lienzoEnBlanco(100, 150)];
    const hojas = dividirEnHojas(paginas);
    expect(hojas.map((h) => h.indicePdf)).toEqual([0, 1, 1, 2]);
  });
});

// ---------- leerExamen de punta a punta, con OCR falso (rápido, sin tesseract) ----------

describe("leerExamen (con OCR falso)", () => {
  // Tres hojas: la 0 trae solo el rótulo de CE-1; la 1 trae el final de CE-1
  // (heredado) y el rótulo de CE-2; la 2 no trae ningún rótulo y es pura
  // continuación de CE-2 hasta el final del examen. Cubre el caso difícil del
  // encargo: una tarea que sigue en la hoja siguiente y otra que corre una
  // hoja entera sin su propio rótulo.
  const paginas = [hojaSintetica(100), hojaSintetica(80), hojaSintetica(null)];

  it("produce las 14 tareas de la estructura, trocea el texto entre hojas y no deja que una tarea rota hunda a las demás", async () => {
    const reconocer = reconocerDeCola([
      "TAREA 1", // hoja0: candidata de la regla en y=100
      "1", // hoja0: pie
      "TAREA 2", // hoja1: candidata de la regla en y=80
      "2", // hoja1: pie
      "3", // hoja2: pie (sin candidatas de regla)
      new Error("tesseract se cayó en este recorte"), // CE-1, región 1 (hoja0: 100-280): falla
      "sobrante que ya no se lee", // CE-1, región 2 (hoja1: 17-30): no debería importar, CE-1 ya quedó en error
      "", // CE-2, región 1 (hoja1: 80-280)
      "", // CE-2, región 2 (hoja2: 17-280)
    ]);

    const resultado = await leerExamen(NIVEL, paginas, { reconocerRotulo: reconocer, reconocerCuerpo: reconocer });

    expect(resultado.tareas).toHaveLength(14);
    expect(resultado.paginas).toEqual([
      { indicePdf: 0, lado: null, etiquetas: ["CE-1"], segura: true },
      { indicePdf: 1, lado: null, etiquetas: ["CE-1", "CE-2"], segura: true },
      { indicePdf: 2, lado: null, etiquetas: ["CE-2"], segura: true },
    ]);

    const ce1 = resultado.tareas.find((t) => t.etiqueta === "CE-1")!;
    expect(ce1.error).toBe("tesseract se cayó en este recorte");
    expect(ce1.formulario).toEqual(formularioVacio(reglaDe(NIVEL, "CE", 1)!));
    expect(ce1.dudas.some((d) => d.clave === "_tarea" && d.nota.includes("tesseract se cayó"))).toBe(true);
    expect(ce1.paginasOrigen).toEqual([0, 1]);

    // CE-1 falló, pero CE-2 (procesada justo después) tiene que salir bien: ninguna tarea se lleva a las demás por delante.
    const ce2 = resultado.tareas.find((t) => t.etiqueta === "CE-2")!;
    expect(ce2.error).toBeNull();
    expect(ce2.paginasOrigen).toEqual([1, 2]);
    if (ce2.formulario.forma !== "LISTA_COMUN") throw new Error("CE-2 tiene que ser LISTA_COMUN");
    expect(ce2.formulario.actividad.preguntas).toHaveLength(6);
    expect(ce2.formulario.actividad.comunes.map((c) => c.letra)).toEqual(["A", "B", "C"]);

    // Las otras doce tareas no tuvieron ninguna página etiquetada: esqueleto vacío y aviso explícito, nunca un error ni contenido inventado.
    const sinPaginas = resultado.tareas.filter((t) => t.etiqueta !== "CE-1" && t.etiqueta !== "CE-2");
    expect(sinPaginas).toHaveLength(12);
    for (const t of sinPaginas) {
      expect(t.paginasOrigen).toEqual([]);
      expect(t.error).toBeNull();
      expect(t.dudas.some((d) => d.clave === "_tarea" && d.nota.includes("No se encontró"))).toBe(true);
    }
  });
});

// ---------- integración real contra el corpus (lenta, se salta sin él) ----------

describe.skipIf(!HAY_CORPUS)("leerExamen contra el corpus real (examen 2, con tesseract.js)", () => {
  let sesion: SesionOcr;

  beforeAll(async () => {
    sesion = await crearSesionOcr();
  }, 60_000);

  afterAll(async () => {
    await sesion.cerrar();
  });

  function paginaDelCorpus(archivo: string): Lienzo {
    const png = PNG.sync.read(readFileSync(path.join(CARPETA_CORPUS, archivo)));
    return { ancho: png.width, alto: png.height, datos: Uint8ClampedArray.from(png.data) };
  }

  it(
    "lee el examen 2 completo (7 pliegos dobles) y produce las 14 tareas, la mayoría con páginas de origen",
    async () => {
      const manifest = JSON.parse(readFileSync(path.join(CARPETA_CORPUS, "manifest.json"), "utf-8")) as {
        examen: number;
        pagina_pdf: number;
        archivo: string;
      }[];
      const archivos = manifest
        .filter((p) => p.examen === 2)
        .sort((a, b) => a.pagina_pdf - b.pagina_pdf)
        .map((p) => p.archivo);
      expect(archivos).toHaveLength(7); // 7 pliegos dobles, ver manifest.json

      const paginas = archivos.map(paginaDelCorpus);
      const resultado = await leerExamen(NIVEL, paginas, sesion);

      expect(resultado.tareas).toHaveLength(14);
      expect(resultado.tareas.map((t) => t.etiqueta)).toEqual([
        "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4", "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
      ]);
      // Ninguna tarea lanza ni queda a medias: cada una trae su propio esqueleto como mínimo.
      for (const t of resultado.tareas) {
        expect(t.formulario).toBeTruthy();
        expect(Array.isArray(t.dudas)).toBe(true);
      }
      // No es una prueba exacta de calidad de OCR (eso lo mide el informe aparte): solo que el
      // troceo encuentra páginas de origen para casi todas las tareas del examen más limpio del corpus.
      const conPaginas = resultado.tareas.filter((t) => t.paginasOrigen.length > 0);
      expect(conPaginas.length).toBeGreaterThanOrEqual(10);
    },
    300_000,
  );
});
