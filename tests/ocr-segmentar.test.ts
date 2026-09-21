// tests/ocr-segmentar.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import type { Lienzo } from "@/lib/taller/ocr/imagen";
import { bandasDePagina, partirPorElLomo, reglasDeTarea } from "@/lib/taller/ocr/segmentar";

// El corpus vive fuera del repo, en el scratchpad de la sesión que lo generó
// (49 páginas renderizadas de los exámenes 1-6, ver manifest.json). Si algún
// día no está disponible, estas pruebas se saltan solas en vez de romper la
// suite; las sintéticas de más abajo no dependen de él.
const CARPETA_CORPUS = "/private/tmp/claude-501/-Users-pablo/8bb3590b-5e22-483c-a399-8015a4cf3aba/scratchpad/corpus";
const HAY_CORPUS = existsSync(path.join(CARPETA_CORPUS, "manifest.json"));

function paginaDelCorpus(archivo: string): Lienzo {
  const png = PNG.sync.read(readFileSync(path.join(CARPETA_CORPUS, archivo)));
  return { ancho: png.width, alto: png.height, datos: Uint8ClampedArray.from(png.data) };
}

// ---------- fixtures sintéticas ----------

function lienzoEnBlanco(ancho: number, alto: number): Lienzo {
  return { ancho, alto, datos: new Uint8ClampedArray(ancho * alto * 4).fill(255) };
}

/** Devuelve un lienzo nuevo con el rectángulo `[x0,x1) x [y0,y1)` pintado en gris. Nunca muta `lienzo`. */
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

/** Un lienzo con barra de cabecera (filas [10,16]) y de pie (filas [alto-20,alto-10)), como en el libro real. */
function lienzoConBandas(ancho: number, alto: number): Lienzo {
  const conCabecera = pintarRectangulo(lienzoEnBlanco(ancho, alto), 0, ancho, 10, 17, GRIS_DE_BARRA);
  return pintarRectangulo(conCabecera, 0, ancho, alto - 20, alto - 10, GRIS_DE_BARRA);
}

describe("bandasDePagina", () => {
  it("encuentra dónde termina la barra de cabecera y dónde empieza la de pie", () => {
    const lienzo = lienzoConBandas(200, 300);
    expect(bandasDePagina(lienzo)).toEqual({ cabecera: 17, pie: 280 });
  });

  it("sin barras, no recorta nada del cuerpo", () => {
    expect(bandasDePagina(lienzoEnBlanco(200, 300))).toEqual({ cabecera: 0, pie: 300 });
  });
});

describe("reglasDeTarea", () => {
  it("encuentra las reglas finas del cuerpo y no las barras gruesas", () => {
    const base = lienzoConBandas(200, 300);
    // Dos reglas fake: filas de un solo píxel de alto que cubren casi todo el ancho.
    const conReglas = [100, 200].reduce((l, y) => pintarRectangulo(l, 10, 190, y, y + 1, NEGRO), base);

    expect(reglasDeTarea(conReglas)).toEqual([100, 200]);
  });

  it("una barra gruesa (cabecera o pie) nunca cuenta como regla", () => {
    // Solo lleva las bandas: ninguna regla en el cuerpo.
    expect(reglasDeTarea(lienzoConBandas(200, 300))).toEqual([]);
  });
});

describe("partirPorElLomo", () => {
  it("una página vertical (perfil single) pasa sin tocarse", () => {
    const lienzo = lienzoEnBlanco(100, 150);
    const partes = partirPorElLomo(lienzo);
    expect(partes).toHaveLength(1);
    expect(partes[0]).toEqual(lienzo);
  });

  it("una doble página se parte por el hueco en blanco, sin dejarse arrastrar por una mancha oscura", () => {
    // 300x200 apaisada: perfil spread. Una "ilustración" oscura pegada al
    // borde izquierdo (columnas 20-50, fuera de la banda 40%-60% = [120,180))
    // no debe arrastrar el corte hacia allá.
    let lienzo = pintarRectangulo(lienzoEnBlanco(300, 200), 20, 50, 0, 200, 10);
    // Texto disperso a ambos lados del lomo real, dejando un hueco limpio en [148,153).
    for (let y = 0; y < 200; y += 3) {
      lienzo = pintarRectangulo(lienzo, 100, 148, y, y + 1, NEGRO);
      lienzo = pintarRectangulo(lienzo, 153, 200, y, y + 1, NEGRO);
    }

    const partes = partirPorElLomo(lienzo);
    expect(partes).toHaveLength(2);
    const [izquierda, derecha] = partes;
    expect(izquierda.ancho + derecha.ancho).toBe(300);
    expect(izquierda.alto).toBe(200);
    expect(derecha.alto).toBe(200);
    // El corte cae dentro del hueco real, lejos de la mancha oscura de la izquierda.
    expect(izquierda.ancho).toBeGreaterThanOrEqual(148);
    expect(izquierda.ancho).toBeLessThanOrEqual(153);
  });

  it("con tinta pareja en toda la banda central, corta por su centro geométrico en vez de dejarse arrastrar a un lado", () => {
    // Apaisada, pero sin ningún hueco: toda la banda [120,180) tiene la misma
    // fracción de tinta. Sin una columna más despejada que las demás, el
    // mejor corte posible es el centro de esa banda, no un extremo cualquiera.
    let lienzo = lienzoEnBlanco(300, 200);
    for (let y = 0; y < 200; y += 2) lienzo = pintarRectangulo(lienzo, 120, 180, y, y + 1, NEGRO);
    const [izquierda, derecha] = partirPorElLomo(lienzo);
    expect(izquierda.ancho).toBe(150);
    expect(derecha.ancho).toBe(150);
  });
});

describe.skipIf(!HAY_CORPUS)("segmentación contra el corpus real de exámenes", () => {
  it("una página 'single' del corpus (examen 1) pasa sin partirse", () => {
    const lienzo = paginaDelCorpus("e1_p01.png");
    expect(lienzo.ancho).toBeLessThan(lienzo.alto); // vertical, como todo perfil "single"
    const partes = partirPorElLomo(lienzo);
    expect(partes).toHaveLength(1);
    expect(partes[0].ancho).toBe(lienzo.ancho);
    expect(partes[0].alto).toBe(lienzo.alto);
  });

  it("una página 'spread' del corpus (examen 2) se parte en dos mitades de anchura plausible", () => {
    const lienzo = paginaDelCorpus("e2_p02.png");
    expect(lienzo.ancho).toBeGreaterThan(lienzo.alto); // apaisada, como todo perfil "spread"
    const [izquierda, derecha] = partirPorElLomo(lienzo);
    expect(izquierda.alto).toBe(lienzo.alto);
    expect(derecha.alto).toBe(lienzo.alto);
    // Ninguna mitad puede ser una tira minúscula: el lomo tiene que haber caído cerca del centro.
    expect(izquierda.ancho).toBeGreaterThan(lienzo.ancho * 0.3);
    expect(derecha.ancho).toBeGreaterThan(lienzo.ancho * 0.3);
    expect(izquierda.ancho + derecha.ancho).toBe(lienzo.ancho);
  });

  it("encuentra cabecera y pie razonables en una página real", () => {
    const { cabecera, pie } = bandasDePagina(paginaDelCorpus("e1_p03.png"));
    const { alto } = paginaDelCorpus("e1_p03.png");
    expect(cabecera).toBeGreaterThan(0);
    expect(cabecera).toBeLessThan(alto * 0.1);
    expect(pie).toBeGreaterThan(alto * 0.85);
    expect(pie).toBeLessThan(alto);
  });

  it("encuentra la regla de TAREA 2 en e1_p03 (donde la verdad de terreno dice que arranca CE-2)", () => {
    const lienzo = paginaDelCorpus("e1_p03.png");
    const reglas = reglasDeTarea(lienzo);
    expect(reglas.length).toBeGreaterThanOrEqual(1);
    // Confirmado a mano contra el PNG: la raya de "TAREA 2" cae sobre la fila 220.
    expect(reglas.some((y) => y > 200 && y < 260)).toBe(true);
  });
});
