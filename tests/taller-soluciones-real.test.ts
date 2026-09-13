// tests/taller-soluciones-real.test.ts
// Se salta sola si no se pasa CUADERNILLO_REAL. El PDF no entra en el repo
// (es público): la variable apunta a la copia del Mac del proyecto. Solo se
// comprueban cuentas, nunca letras reales.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS } from "@/lib/dele/estructura";
import { leerSoluciones, resumenDeSoluciones } from "@/lib/taller/soluciones";
import { trozosDeDocumento } from "@/lib/taller/trozos";

const RUTA = process.env.CUADERNILLO_REAL;

describe.skipIf(!RUTA)("el cuadernillo real", () => {
  // Mutación que la mata (comprobada contra el PDF real): usar `<=` en vez
  // de `<` en el bucle de `encontradas` de resumenDeSoluciones (cuenta un
  // ítem de más por tarea; `bien` sale false en varios de los seis exámenes
  // reales). Verificado sin mirar letras: solo cambian los conteos.
  it("da seis exámenes con 25 + 25 respuestas, todas en su tarea", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const datos = new Uint8Array(readFileSync(RUTA!));
    const doc = await pdfjs.getDocument({ data: datos, useSystemFonts: true }).promise;
    const resumen = resumenDeSoluciones(leerSoluciones(await trozosDeDocumento(doc)), ESTRUCTURAS.A2_B1_ESCOLAR!);
    expect(resumen.map((r) => r.examen)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(resumen.filter((r) => !r.bien)).toEqual([]);
  }, 30_000);
});
