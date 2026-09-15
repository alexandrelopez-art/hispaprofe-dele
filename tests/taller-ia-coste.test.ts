import { describe, it, expect } from "vitest";
import { costeEnMilesimas, SIN_USO, textoDelGasto } from "@/lib/taller/ia/coste";

describe("el coste de una llamada a la IA", () => {
  // 10.000 × 0,005 + 20.000 × 0,0005 + 4.000 × 0,00625 + 3.000 × 0,025 = 50 + 10 + 25 + 75
  // Mutación que la mata: cobrar la caché leída a precio de entrada (0,005).
  it("suma entrada, caché leída, caché escrita y salida con sus tarifas", () => {
    expect(costeEnMilesimas({ entrada: 10_000, cacheLeidos: 20_000, cacheEscritos: 4_000, salida: 3_000 })).toBe(160);
  });

  // Mutación que la mata: cobrar la salida a 0,005 como la entrada.
  it("la salida cuesta cinco veces la entrada", () => {
    expect(costeEnMilesimas({ ...SIN_USO, salida: 1_000 })).toBe(25);
    expect(costeEnMilesimas({ ...SIN_USO, entrada: 1_000 })).toBe(5);
  });

  // Mutación que la mata: devolver milésimas con decimales (quitar Math.round).
  it("redondea a milésimas enteras", () => {
    expect(Number.isInteger(costeEnMilesimas({ ...SIN_USO, entrada: 333 }))).toBe(true);
  });
});

describe("el texto del gasto de un examen", () => {
  // Mutación que la mata: formatear con punto decimal ("1.84").
  it("dice dólares con coma y cuántas llamadas", () => {
    expect(textoDelGasto({ llamadas: 14, milesimas: 1_840 })).toBe("IA: 1,84 $ en 14 llamadas");
  });

  // Mutación que la mata: quitar el singular.
  it("una llamada va en singular", () => {
    expect(textoDelGasto({ llamadas: 1, milesimas: 90 })).toBe("IA: 0,09 $ en 1 llamada");
  });

  // Mutación que la mata: devolver "IA: 0,00 $ en 0 llamadas" en vez de null.
  it("sin llamadas no dice nada", () => {
    expect(textoDelGasto({ llamadas: 0, milesimas: 0 })).toBeNull();
  });
});
