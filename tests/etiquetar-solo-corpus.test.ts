// tests/etiquetar-solo-corpus.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hoja } from "@/lib/taller/ia/encargo";
import { decodificarHoja } from "@/lib/taller/ocr/decodificar";
import { crearSesionOcr, detectarRotulosDePagina, type SesionOcr } from "@/lib/taller/ocr/rotulos";

/**
 * La prueba de integración que demuestra el arreglo: el número de página
 * impreso -lo que `senal-de-pagina.ts` (ya borrado) no podía leer nunca del
 * texto de página completa- sale correcto al leerlo de una tira recortada de
 * verdad, con `decodificarHoja` + `detectarRotulosDePagina` de punta a punta.
 *
 * El corpus vive fuera del repositorio, en el scratchpad de la sesión que lo
 * generó (ya recortado en caras sueltas, con su verdad de terreno). Si algún
 * día no está disponible, esta prueba se salta sola, igual que
 * ocr-rotulos.test.ts y ocr-segmentar.test.ts con su propio corpus.
 */
const CARPETA_SCRATCHPAD = "/private/tmp/claude-501/-Users-pablo/8bb3590b-5e22-483c-a399-8015a4cf3aba/scratchpad";
const CARPETA_RECORTES = path.join(CARPETA_SCRATCHPAD, "recortes");
const RUTA_VERDAD = path.join(CARPETA_SCRATCHPAD, "ground-truth-tareas.json");
const HAY_CORPUS = existsSync(RUTA_VERDAD) && existsSync(CARPETA_RECORTES);

type FilaDeVerdad = {
  examen: number;
  archivo: string;
  lado: "izquierda" | "derecha" | null;
  pagina_libro: number | null;
  etiquetas: string[];
};

function hojaDeRecorte(archivo: string): Hoja {
  const bytes = readFileSync(path.join(CARPETA_RECORTES, archivo));
  return { datos: bytes.toString("base64"), tipo: "image/png" };
}

describe.skipIf(!HAY_CORPUS)("etiquetado automático contra el corpus real: números de página", () => {
  let sesion: SesionOcr;
  let verdad: FilaDeVerdad[];

  beforeAll(async () => {
    sesion = await crearSesionOcr();
    verdad = JSON.parse(readFileSync(RUTA_VERDAD, "utf-8")) as FilaDeVerdad[];
  }, 60_000);

  afterAll(async () => {
    await sesion.cerrar();
  });

  function paginaLibroDeVerdad(examen: number, archivo: string, lado: "izquierda" | "derecha" | null): number {
    const fila = verdad.find((f) => f.examen === examen && f.archivo === archivo && f.lado === lado);
    if (!fila || fila.pagina_libro === null) throw new Error(`No hay verdad de terreno con página de libro para ${archivo} (${lado}).`);
    return fila.pagina_libro;
  }

  it(
    "lee los números de página correctos en las dos caras de una doble página (examen 2, página 3 del cuadernillo)",
    async () => {
      const izquierda = decodificarHoja(hojaDeRecorte("e2_p03_izquierda.png"));
      const derecha = decodificarHoja(hojaDeRecorte("e2_p03_derecha.png"));

      const resultadoIzquierda = await detectarRotulosDePagina(izquierda, sesion.reconocerRotulo);
      const resultadoDerecha = await detectarRotulosDePagina(derecha, sesion.reconocerRotulo);

      expect(resultadoIzquierda.numeroImpreso).toBe(paginaLibroDeVerdad(2, "e2_p03.png", "izquierda"));
      expect(resultadoDerecha.numeroImpreso).toBe(paginaLibroDeVerdad(2, "e2_p03.png", "derecha"));
    },
    30_000,
  );

  it(
    "lee el número de página correcto en una página suelta (examen 1, página 1 del cuadernillo, sin partir)",
    async () => {
      const lienzo = decodificarHoja(hojaDeRecorte("e1_p01_unica.png"));
      const resultado = await detectarRotulosDePagina(lienzo, sesion.reconocerRotulo);

      expect(resultado.numeroImpreso).toBe(paginaLibroDeVerdad(1, "e1_p01.png", null));
    },
    30_000,
  );
});
