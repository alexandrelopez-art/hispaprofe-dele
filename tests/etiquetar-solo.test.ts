import { PNG } from "pngjs";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

// Igual que en tests/taller-ia-interpretar.test.ts: etiquetar-solo.ts importa
// "@/lib/db" a nivel de módulo (para leer el examen y escribir las
// etiquetas), así que sin este doble cargar el fichero exigiría DATABASE_URL.
const dobles = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    examen: { findUnique: dobles.findUnique },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $queryRaw: dobles.queryRaw, paginaDeExamen: { update: dobles.update } }),
  },
}));

import type { Hoja } from "@/lib/taller/ia/encargo";
import type { Lienzo } from "@/lib/taller/ocr/imagen";
import type { SesionOcr } from "@/lib/taller/ocr/rotulos";
import { MENSAJE_ARCHIVADO, MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
import { etiquetarPaginasAutomaticamente, type Dependencias } from "@/lib/taller/ocr/etiquetar-solo";

/**
 * Fixtures de píxeles: mismo estilo que tests/ocr-rotulos.test.ts y
 * tests/ocr-segmentar.test.ts. Aquí, además, se codifican a PNG de verdad
 * (con pngjs) para que `descargar` pueda devolver bytes que `decodificarHoja`
 * decodifique de verdad — la parte nueva que hay que probar-, mientras que el
 * texto que "lee" cada tira sigue siendo un OCR falso inyectado por
 * `abrirSesion`, igual que antes.
 */
const NEGRO = 0;
const GRIS_DE_BARRA = 130;
const ANCHO_SOLA = 200;
const ALTO_SOLA = 300;
const ANCHO_SPREAD = 400;
const ALTO_SPREAD = 300;

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

/** Una página suelta (perfil "single", nunca se parte): cabecera, pie y, si `conTarea`, una regla de tarea en el cuerpo. */
function lienzoSolaDePrueba(conTarea: boolean): Lienzo {
  let l = lienzoEnBlanco(ANCHO_SOLA, ALTO_SOLA);
  l = pintarRectangulo(l, 0, ANCHO_SOLA, 10, 17, GRIS_DE_BARRA);
  l = pintarRectangulo(l, 0, ANCHO_SOLA, 280, 290, GRIS_DE_BARRA);
  if (conTarea) l = pintarRectangulo(l, 10, 190, 100, 101, NEGRO);
  return l;
}

/**
 * Una doble página (perfil "spread", 400x300 apaisada): cabecera y pie a todo
 * lo ancho, un hueco en blanco entre columnas [160,240) para que
 * `partirPorElLomo` la corte limpiamente por x=200, y una regla de tarea
 * opcional en cada mitad, lejos del hueco para no interferir con el corte.
 */
function lienzoSpreadDePrueba(tareaIzquierda: boolean, tareaDerecha: boolean): Lienzo {
  let l = lienzoEnBlanco(ANCHO_SPREAD, ALTO_SPREAD);
  l = pintarRectangulo(l, 0, ANCHO_SPREAD, 10, 17, GRIS_DE_BARRA);
  l = pintarRectangulo(l, 0, ANCHO_SPREAD, 280, 290, GRIS_DE_BARRA);
  if (tareaIzquierda) l = pintarRectangulo(l, 10, 150, 100, 101, NEGRO);
  if (tareaDerecha) l = pintarRectangulo(l, 250, 390, 100, 101, NEGRO);
  return l;
}

function comoHojaPng(lienzo: Lienzo): Hoja {
  const png = new PNG({ width: lienzo.ancho, height: lienzo.alto });
  Buffer.from(lienzo.datos.buffer, lienzo.datos.byteOffset, lienzo.datos.byteLength).copy(png.data);
  return { datos: PNG.sync.write(png).toString("base64"), tipo: "image/png" };
}

const HOJA_CORRUPTA: Hoja = { datos: Buffer.from("no es una imagen").toString("base64"), tipo: "image/png" };

type PaginaDePrueba = { id: string; orden: number; fichero: { ruta: string; tipoMime: string } };

function pagina(id: string, orden: number): PaginaDePrueba {
  return { id, orden, fichero: { ruta: `material/${id}.png`, tipoMime: "image/png" } };
}

function examen(estado: string, nivel: string, paginas: PaginaDePrueba[]) {
  return { id: "x1", estado, nivel, paginas };
}

/**
 * Una sesión de lectura falsa: `hojas` da, en el mismo orden que las páginas
 * del examen, el `Hoja` que "descargar" debe devolver; `tiras` da, en el
 * orden en que `detectarRotulosDePagina` las pide (una por cada regla
 * candidata de cada lado, y una por el pie de cada lado), el texto que el
 * OCR falso reconoce en esa tira.
 */
function sesionFalsa(hojas: readonly Hoja[], tiras: readonly string[]): { deps: Dependencias; aperturas: () => number; cierres: () => number } {
  let aperturas = 0;
  let cierres = 0;
  let siguienteHoja = 0;
  let siguienteTira = 0;
  return {
    deps: {
      descargar: async (): Promise<Hoja> => hojas[siguienteHoja++],
      abrirSesion: async (): Promise<SesionOcr> => {
        aperturas++;
        return {
          reconocerRotulo: async () => tiras[siguienteTira++] ?? "",
          reconocerCuerpo: async () => "",
          cerrar: async () => {
            cierres++;
          },
        };
      },
    },
    aperturas: () => aperturas,
    cierres: () => cierres,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  dobles.queryRaw.mockResolvedValue([{ estado: "EN_CONSTRUCCION" }]);
  dobles.update.mockResolvedValue({});
});

describe("etiquetarPaginasAutomaticamente — guardas antes de tocar el OCR", () => {
  it("un examen que no existe no llega a descargar nada", async () => {
    dobles.findUnique.mockResolvedValue(null);
    const { deps, aperturas } = sesionFalsa([], []);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: "Ese examen no existe." });
    expect(aperturas()).toBe(0);
  });

  it("un examen publicado no se toca", async () => {
    dobles.findUnique.mockResolvedValue(examen("PUBLICADO", "A2_B1_ESCOLAR", [pagina("a", 1)]));
    const { deps, aperturas } = sesionFalsa([], []);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(aperturas()).toBe(0);
  });

  it("un examen archivado no se toca", async () => {
    dobles.findUnique.mockResolvedValue(examen("ARCHIVADO", "A2_B1_ESCOLAR", [pagina("a", 1)]));
    expect(await etiquetarPaginasAutomaticamente("x1", sesionFalsa([], []).deps)).toEqual({ error: MENSAJE_ARCHIVADO });
  });

  it("un examen sin páginas no llega a abrir sesión de lectura", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", []));
    const { deps, aperturas } = sesionFalsa([], []);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: "Este examen no tiene páginas todavía." });
    expect(aperturas()).toBe(0);
  });

  // Mutación que la mata: no comprobar ESTRUCTURAS antes de gastar tiempo de OCR en un nivel sin secuencia.
  it("un nivel sin estructura cargada avisa sin gastar OCR", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A1", [pagina("a", 1)]));
    const { deps, aperturas } = sesionFalsa([], []);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: "Este nivel todavía no tiene la secuencia de tareas cargada." });
    expect(aperturas()).toBe(0);
  });
});

describe("etiquetarPaginasAutomaticamente — el camino feliz", () => {
  it("etiqueta cada página, abre y cierra una única sesión de lectura, y escribe en la base", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 48), pagina("p2", 49)]));
    const hojas = [comoHojaPng(lienzoSolaDePrueba(true)), comoHojaPng(lienzoSolaDePrueba(false))];
    // p1: una regla ("TAREA 1") + su pie ("cuarenta y ocho"). p2: sin regla (0 candidatas) + su pie ("cuarenta y nueve").
    const { deps, aperturas, cierres } = sesionFalsa(hojas, ["TAREA 1", "cuarenta y ocho", "cuarenta y nueve"]);

    const resultado = await etiquetarPaginasAutomaticamente("x1", deps);

    expect(resultado).toEqual({ paginas: 2, etiquetadas: 2, inciertas: [] });
    // Una sola sesión reutilizada para las dos hojas: crear un worker por página es lentísimo.
    expect(aperturas()).toBe(1);
    expect(cierres()).toBe(1);
    expect(dobles.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { etiquetas: ["CE-1"] } });
    expect(dobles.update).toHaveBeenCalledWith({ where: { id: "p2" }, data: { etiquetas: ["CE-1"] } });
  });

  it("reporta las páginas inseguras para que el profesor las revise, sin ocultar la duda", async () => {
    // Ni pie de página ni rótulo en ninguna de las dos: sin ancla ninguna, el
    // resolutor no puede colocarlas y las marca a las dos como inseguras.
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 1), pagina("p2", 2)]));
    const hojas = [comoHojaPng(lienzoSolaDePrueba(false)), comoHojaPng(lienzoSolaDePrueba(false))];
    const { deps } = sesionFalsa(hojas, ["NN EBEtema", "NN EBEtema"]);

    const resultado = await etiquetarPaginasAutomaticamente("x1", deps);

    expect(resultado).toEqual({
      paginas: 2,
      etiquetadas: 0,
      inciertas: [
        { id: "p1", orden: 1, etiquetas: [] },
        { id: "p2", orden: 2, etiquetas: [] },
      ],
    });
  });

  // La parte que rompía antes del arreglo: una hoja escaneada como doble
  // página (lo habitual en el corpus real) tiene que producir UNA sola fila
  // etiquetada en la base, con la unión de lo leído en cada cara -exactamente
  // el patrón que trae el corpus (p.ej. examen 2, página 65: CE-2 y CE-3).
  it("una hoja en doble página se etiqueta como una sola fila, combinando lo leído en cada cara", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 1)]));
    const hojas = [comoHojaPng(lienzoSpreadDePrueba(true, true))];
    // Orden de llamadas: izquierda primero (regla + pie), luego derecha (regla + pie).
    const { deps, aperturas } = sesionFalsa(hojas, ["TAREA 1", "sesenta y cuatro", "TAREA 2", "sesenta y cinco"]);

    const resultado = await etiquetarPaginasAutomaticamente("x1", deps);

    expect(resultado).toEqual({ paginas: 1, etiquetadas: 1, inciertas: [] });
    expect(aperturas()).toBe(1);
    expect(dobles.update).toHaveBeenCalledTimes(1);
    expect(dobles.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { etiquetas: ["CE-1", "CE-2"] } });
  });
});

describe("etiquetarPaginasAutomaticamente — fallos a mitad de camino", () => {
  it("una hoja que no se descarga del almacén aborta sin abrir sesión de lectura", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 1), pagina("p2", 2)]));
    const { deps, aperturas } = sesionFalsa([], []);
    let llamadas = 0;
    const conFalloDeDescarga: Dependencias = {
      ...deps,
      descargar: async () => {
        llamadas++;
        if (llamadas === 1) throw new Error("almacén caído");
        return comoHojaPng(lienzoSolaDePrueba(false));
      },
    };

    expect(await etiquetarPaginasAutomaticamente("x1", conFalloDeDescarga)).toEqual({ error: "No se pudo leer la hoja 1 del almacén." });
    expect(aperturas()).toBe(0);
    expect(dobles.update).not.toHaveBeenCalled();
  });

  // Nuevo con el arreglo: la decodificación también pasa ANTES de abrir la
  // sesión de lectura, por la misma razón que la descarga (no gastar el
  // arranque de un worker de tesseract en un examen que ya se sabe roto).
  it("una hoja con una imagen que no se puede decodificar aborta sin abrir sesión de lectura", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 1)]));
    const { deps, aperturas } = sesionFalsa([HOJA_CORRUPTA], []);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: "No se pudo decodificar la imagen de la hoja 1." });
    expect(aperturas()).toBe(0);
    expect(dobles.update).not.toHaveBeenCalled();
  });

  it("un examen que se publica justo antes de guardar no pierde las etiquetas en silencio: vuelve con el aviso", async () => {
    dobles.findUnique.mockResolvedValue(examen("EN_CONSTRUCCION", "A2_B1_ESCOLAR", [pagina("p1", 1)]));
    dobles.queryRaw.mockResolvedValue([{ estado: "PUBLICADO" }]);
    const hojas = [comoHojaPng(lienzoSolaDePrueba(true))];
    const { deps } = sesionFalsa(hojas, ["TAREA 1", "cincuenta"]);

    expect(await etiquetarPaginasAutomaticamente("x1", deps)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(dobles.update).not.toHaveBeenCalled();
  });
});
