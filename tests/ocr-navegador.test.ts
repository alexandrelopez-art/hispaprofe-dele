// tests/ocr-navegador.test.ts
//
// navegador.ts es "solo navegador" (usa document, canvas y el Worker de
// tesseract.js), y esta suite corre en Node sin jsdom ni happy-dom
// instalados (ver vitest.config.ts: no hay `environment`, y las pruebas de
// componentes del repo usan `renderToStaticMarkup`, no un DOM real). Así que
// aquí solo se prueba lo que es genuinamente independiente del navegador:
//   - la validación y traducción de formas (esLienzoValido, lienzoDesdeImageData),
//   - la secuencia y el ciclo de vida (crearSesionOcrNavegador, lienzosDePdf),
//     con `document`, `pdfjs-dist` y `tesseract.js` sustituidos por dobles.
// Lo que de verdad depende de un navegador -que `putImageData` pinte los
// píxeles correctos, que `canvas.toBlob()` produzca un PNG legible, que
// pdfjs renderice de verdad- no se prueba aquí porque no se puede: queda
// dicho en el informe, no fingido con una prueba que no ejercita nada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { luminancia } from "@/lib/taller/ocr/imagen";
import type { Lienzo } from "@/lib/taller/ocr/imagen";
import { crearSesionOcrNavegador, esLienzoValido, lienzoDesdeImageData, lienzosDePdf } from "@/lib/taller/ocr/navegador";

const dobles = vi.hoisted(() => ({
  createWorker: vi.fn(),
  getDocument: vi.fn(),
}));

/** Los mismos valores que el enum PSM real de tesseract.js (ver rotulos.ts): solo hacen falta como marcadores, nunca se interpretan aquí. */
const PSM_FALSO = { SINGLE_BLOCK: "6", AUTO: "3" };

// Ambos import dinámicos ("tesseract.js" y "pdfjs-dist", dentro de navegador.ts)
// pasan por el mismo mecanismo de vi.mock que un import estático.
vi.mock("tesseract.js", () => ({ createWorker: dobles.createWorker, PSM: PSM_FALSO }));
vi.mock("pdfjs-dist", () => ({ getDocument: dobles.getDocument, GlobalWorkerOptions: {} }));

beforeEach(() => {
  dobles.createWorker.mockReset();
  dobles.getDocument.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("esLienzoValido", () => {
  it("acepta un lienzo cuyos bytes cuadran con ancho x alto x 4", () => {
    expect(esLienzoValido({ ancho: 2, alto: 3, datos: new Uint8ClampedArray(24) })).toBe(true);
  });

  it("rechaza un lienzo con menos bytes de los que le tocan", () => {
    expect(esLienzoValido({ ancho: 2, alto: 3, datos: new Uint8ClampedArray(20) })).toBe(false);
  });

  it("rechaza un lienzo con ancho 0", () => {
    expect(esLienzoValido({ ancho: 0, alto: 3, datos: new Uint8ClampedArray(0) })).toBe(false);
  });

  it("rechaza un lienzo con alto 0", () => {
    expect(esLienzoValido({ ancho: 3, alto: 0, datos: new Uint8ClampedArray(0) })).toBe(false);
  });
});

describe("lienzoDesdeImageData", () => {
  it("traduce width/height/data de ImageData a ancho/alto/datos de Lienzo", () => {
    const datos = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const imagenFalsa: ImageData = { width: 2, height: 1, data: datos, colorSpace: "srgb" };
    expect(lienzoDesdeImageData(imagenFalsa)).toEqual({ ancho: 2, alto: 1, datos });
  });

  // La prueba que de verdad demuestra el contrato: el Lienzo que sale de un
  // ImageData del navegador es utilizable, sin ninguna conversión más, por
  // una función real de la segmentación (luminancia, de imagen.ts).
  it("el Lienzo resultante lo consume sin cambios el resto del pipeline de OCR", () => {
    const datos = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const imagenFalsa: ImageData = { width: 2, height: 1, data: datos, colorSpace: "srgb" };
    const lienzo = lienzoDesdeImageData(imagenFalsa);
    expect(luminancia(lienzo, 0, 0)).toBeCloseTo(0.299 * 255, 5);
    expect(luminancia(lienzo, 1, 0)).toBeCloseTo(0.587 * 255, 5);
  });
});

/** Un canvas y un contexto 2D falsos, suficientes para lo que usa navegador.ts: tamaño, getContext y putImageData. */
function crearCanvasFalso() {
  const contexto = { putImageData: vi.fn(), getImageData: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => contexto) };
  return { canvas, contexto };
}

class ImageDataFalsa {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

describe("crearSesionOcrNavegador (con tesseract.js y document sustituidos)", () => {
  const RECORTE: Lienzo = { ancho: 2, alto: 1, datos: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]) };

  function stubDocumentoConCanvases() {
    const creados: ReturnType<typeof crearCanvasFalso>[] = [];
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const par = crearCanvasFalso();
        creados.push(par);
        return par.canvas;
      }),
    });
    vi.stubGlobal("ImageData", ImageDataFalsa);
    return creados;
  }

  /** Un worker falso con `setParameters` de más: desde el arreglo de PSM, `crearSesionOcrNavegador` lo llama antes de cada `recognize`. */
  function workerFalso(texto = "") {
    return {
      recognize: vi.fn().mockResolvedValue({ data: { text: texto } }),
      setParameters: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("crea el worker una sola vez aunque se reconozcan varias tiras, y lo cierra con terminate", async () => {
    const worker = workerFalso("TAREA 1");
    dobles.createWorker.mockResolvedValue(worker);
    const canvasesCreados = stubDocumentoConCanvases();

    const sesion = await crearSesionOcrNavegador();
    const texto1 = await sesion.reconocerCuerpo(RECORTE);
    const texto2 = await sesion.reconocerCuerpo(RECORTE);

    expect(texto1).toBe("TAREA 1");
    expect(texto2).toBe("TAREA 1");
    // Mutación que la mata: crear un worker por cada llamada a reconocer en vez de reutilizar el mismo.
    expect(dobles.createWorker).toHaveBeenCalledTimes(1);
    expect(worker.recognize).toHaveBeenCalledTimes(2);
    expect(worker.recognize.mock.calls[0][0]).toBe(canvasesCreados[0].canvas);
    expect(worker.recognize.mock.calls[1][0]).toBe(canvasesCreados[1].canvas);

    await sesion.cerrar();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("reconocerRotulo y reconocerCuerpo fuerzan cada uno su propio modo de segmentación sobre el mismo worker", async () => {
    const worker = workerFalso();
    dobles.createWorker.mockResolvedValue(worker);
    stubDocumentoConCanvases();

    const sesion = await crearSesionOcrNavegador();
    await sesion.reconocerRotulo(RECORTE);
    await sesion.reconocerCuerpo(RECORTE);

    // Un único worker (dobles.createWorker ya se comprueba aparte): lo que cambia es el
    // parámetro que cada función fuerza justo antes de reconocer, no el worker en sí.
    expect(dobles.createWorker).toHaveBeenCalledTimes(1);
    expect(worker.setParameters.mock.calls[0][0]).toEqual({ tessedit_pageseg_mode: PSM_FALSO.SINGLE_BLOCK });
    expect(worker.setParameters.mock.calls[1][0]).toEqual({ tessedit_pageseg_mode: PSM_FALSO.AUTO });
  });

  it("dibuja el recorte en un canvas del mismo tamaño, con putImageData, antes de pasarlo a tesseract", async () => {
    const worker = workerFalso();
    dobles.createWorker.mockResolvedValue(worker);
    const canvasesCreados = stubDocumentoConCanvases();

    const sesion = await crearSesionOcrNavegador();
    await sesion.reconocerCuerpo(RECORTE);

    const { canvas, contexto } = canvasesCreados[0];
    expect(canvas.width).toBe(RECORTE.ancho);
    expect(canvas.height).toBe(RECORTE.alto);
    expect(contexto.putImageData).toHaveBeenCalledTimes(1);
    const [imagenPintada, x, y] = contexto.putImageData.mock.calls[0];
    expect(imagenPintada).toBeInstanceOf(ImageDataFalsa);
    // No es la misma referencia (se copia a un ArrayBuffer normal, ver el
    // comentario en canvasDelLienzo), pero sí los mismos bytes.
    expect(imagenPintada.data).toEqual(RECORTE.datos);
    expect(imagenPintada.width).toBe(RECORTE.ancho);
    expect(imagenPintada.height).toBe(RECORTE.alto);
    expect([x, y]).toEqual([0, 0]);
  });

  it("rechaza un lienzo mal formado antes de llegar a tesseract", async () => {
    const worker = workerFalso();
    dobles.createWorker.mockResolvedValue(worker);
    stubDocumentoConCanvases();
    const sesion = await crearSesionOcrNavegador();
    const malFormado: Lienzo = { ancho: 2, alto: 1, datos: new Uint8ClampedArray([1, 2, 3]) };

    await expect(sesion.reconocerCuerpo(malFormado)).rejects.toThrow(/mal formado/);
    expect(worker.recognize).not.toHaveBeenCalled();
  });

  it("pasa las rutas propias a createWorker cuando se dan, y nunca manda una clave con valor indefinido", async () => {
    dobles.createWorker.mockResolvedValue({ recognize: vi.fn(), terminate: vi.fn() });

    await crearSesionOcrNavegador();
    // toStrictEqual (no toEqual): tiene que distinguir "sin la clave" de "la clave con undefined",
    // que es justo el bug que sinIndefinidos existe para evitar (pisaría el default del CDN de tesseract.js).
    expect(dobles.createWorker.mock.calls[0]).toStrictEqual(["spa", undefined, {}]);

    await crearSesionOcrNavegador({ workerPath: "/w.js", corePath: "/core", langPath: "/lang" });
    expect(dobles.createWorker.mock.calls[1]).toStrictEqual(["spa", undefined, { workerPath: "/w.js", corePath: "/core", langPath: "/lang" }]);

    // Mutación que la mata: pasar `opciones` tal cual a createWorker, sin filtrar las claves indefinidas.
    await crearSesionOcrNavegador({ workerPath: undefined, corePath: "/solo-core" });
    expect(dobles.createWorker.mock.calls[2]).toStrictEqual(["spa", undefined, { corePath: "/solo-core" }]);
  });
});

describe("lienzosDePdf (con pdfjs-dist y document sustituidos)", () => {
  function paginaFalsa(n: number, ordenDeLlamadas: string[]) {
    return {
      getViewport: () => ({ width: 10 * n, height: 20 * n }),
      render: () => {
        ordenDeLlamadas.push(`render-${n}`);
        return { promise: Promise.resolve() };
      },
      cleanup: () => {
        ordenDeLlamadas.push(`cleanup-${n}`);
      },
    };
  }

  it("procesa las páginas en orden, una detrás de otra, liberando cada una (cleanup) antes de pedir la siguiente", async () => {
    const ordenDeLlamadas: string[] = [];
    const docFalso = {
      numPages: 3,
      getPage: vi.fn(async (n: number) => {
        ordenDeLlamadas.push(`getPage-${n}`);
        return paginaFalsa(n, ordenDeLlamadas);
      }),
    };
    dobles.getDocument.mockReturnValue({ promise: Promise.resolve(docFalso) });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({
          getImageData: (_x: number, _y: number, ancho: number, alto: number) => ({
            width: ancho,
            height: alto,
            data: new Uint8ClampedArray(ancho * alto * 4),
          }),
        }),
      })),
    });

    const fichero = new File([new Uint8Array([1, 2, 3])], "cuadernillo.pdf", { type: "application/pdf" });
    const lienzos = await lienzosDePdf(fichero);

    expect(lienzos.map((l) => [l.ancho, l.alto])).toEqual([
      [10, 20],
      [20, 40],
      [30, 60],
    ]);
    expect(lienzos.every((l) => l.datos.length === l.ancho * l.alto * 4)).toBe(true);
    // La prueba que de verdad importa para la máquina de 8 GB: nunca se pide
    // la página siguiente antes de renderizar y liberar (cleanup) la actual.
    expect(ordenDeLlamadas).toEqual([
      "getPage-1", "render-1", "cleanup-1",
      "getPage-2", "render-2", "cleanup-2",
      "getPage-3", "render-3", "cleanup-3",
    ]);
  });

  it("devuelve un array vacío para un PDF sin páginas, sin tocar document", async () => {
    dobles.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 0, getPage: vi.fn() }) });
    const creaElemento = vi.fn();
    vi.stubGlobal("document", { createElement: creaElemento });

    const fichero = new File([new Uint8Array([1])], "vacio.pdf", { type: "application/pdf" });
    expect(await lienzosDePdf(fichero)).toEqual([]);
    expect(creaElemento).not.toHaveBeenCalled();
  });
});
