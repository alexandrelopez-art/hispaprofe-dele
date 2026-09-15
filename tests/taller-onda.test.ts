import { describe, it, expect } from "vitest";
import { ajustarMarca, formatearTiempo, leerCortesEscritos, picos, proponerCortes, silencios, trozosDe } from "@/lib/taller/onda";

const HZ = 100;
/** Una señal sintética a 100 muestras por segundo: tramos de [segundos, suena]. */
function senal(tramos: [number, boolean][]): Float32Array {
  const valores: number[] = [];
  for (const [s, suena] of tramos) for (let i = 0; i < Math.round(s * HZ); i++) valores.push(suena ? (i % 2 ? 0.5 : -0.5) : 0);
  return Float32Array.from(valores);
}

// Tres trozos, cada uno oído dos veces: 2 s de silencio entre audiciones y 4 s entre trozos,
// como en las pistas del libro. Duración: 50 s.
const TRES_DOS_VECES: [number, boolean][] = [
  [4, true], [2, false], [5, true], [2, false], [5, true], [4, false],
  [5, true], [2, false], [5, true], [4, false], [5, true], [2, false], [5, true],
];

describe("silencios", () => {
  // Mutación que la mata: contar como silencio un tramo de menos de 1,5 s.
  it("encuentra los tramos de al menos 1,5 s y no los más cortos", () => {
    const s = silencios(senal([[3, true], [1, false], [3, true], [2, false], [3, true]]), HZ);
    expect(s).toEqual([{ inicio: 7, fin: 9 }]);
  });

  // Mutación que la mata: contar cada ventana callada como silencio, sin duración mínima.
  it("en la señal de tres trozos oídos dos veces hay seis silencios", () => {
    expect(silencios(senal(TRES_DOS_VECES), HZ).map((x) => x.fin)).toEqual([6, 13, 22, 29, 38, 45]);
  });

  // Mutación que la mata: umbral fijo en vez de relativo a la ventana más fuerte.
  it("el umbral es el 2 % de lo más fuerte: una pista flojita también tiene silencios", () => {
    const floja = senal([[3, true], [2, false], [3, true]]).map((v) => v / 100);
    expect(silencios(floja, HZ)).toEqual([{ inicio: 3, fin: 5 }]);
  });

  // Mutación que la mata: devolver silencios aunque no haya pista (maximo sea 0).
  it("una pista muda no tiene silencios que proponer", () => {
    expect(silencios(new Float32Array(1000), HZ)).toEqual([]);
  });
});

describe("proponer marcas", () => {
  // Mutación que la mata: quedarse con los primeros silencios en vez de con los más largos.
  it("se queda con los silencios entre trozos, no con los de entre audiciones", () => {
    expect(proponerCortes(silencios(senal(TRES_DOS_VECES), HZ), 3, 50)).toEqual([22, 38]);
  });

  // Mutación que la mata: devolver [] si no hay candidatos de sobra.
  it("con menos candidatos que marcas, propone los que hay, en orden", () => {
    expect(proponerCortes(silencios(senal(TRES_DOS_VECES), HZ), 10, 50)).toEqual([6, 13, 22, 29, 38, 45]);
  });

  // Mutación que la mata: quitar el filtro de los 3 primeros segundos.
  it("nada en los 3 primeros segundos, y nada si la tarea no se corta", () => {
    const s = [{ inicio: 0.5, fin: 2.5 }, { inicio: 10, fin: 20 }];
    expect(proponerCortes(s, 2, 60)).toEqual([20]);
    expect(proponerCortes(s, 1, 60)).toEqual([]);
  });
});

describe("marcas y trozos", () => {
  // Mutación que la mata: no apartar la marca de la vecina.
  it("una marca no queda a menos de 0,3 s de otra ni de los extremos", () => {
    expect(ajustarMarca(10.1, [10], 60)).toBe(10.3);
    expect(ajustarMarca(9.9, [10], 60)).toBe(9.7);
    expect(ajustarMarca(0.1, [], 60)).toBe(0.3);
    expect(ajustarMarca(59.9, [], 60)).toBe(59.7);
    expect(ajustarMarca(10, [9.8, 10.2], 60)).toBeNull();
  });

  // Mutación que la mata: olvidar el último trozo (de la última marca al final).
  it("los trozos cubren la pista de 0 al final sin huecos", () => {
    expect(trozosDe([22, 38], 50)).toEqual([[0, 22], [22, 38], [38, 50]]);
    expect(trozosDe([], 50)).toEqual([[0, 50]]);
  });

  // Mutación que la mata: no llenar de ceros los segundos, o error en la fórmula minutos/segundos.
  it("el tiempo se escribe en minutos y segundos", () => {
    expect(formatearTiempo(102.4)).toBe("1:42");
    expect(formatearTiempo(5)).toBe("0:05");
  });

  // Mutación que la mata: aceptar marcas desordenadas escritas a mano.
  it("las marcas escritas a mano se leen en segundos o en m:ss, y lo que no vale da null", () => {
    expect(leerCortesEscritos("22, 38.5")).toEqual([22, 38.5]);
    expect(leerCortesEscritos("0:22, 1:05")).toEqual([22, 65]);
    expect(leerCortesEscritos("")).toEqual([]);
    expect(leerCortesEscritos("38, 22")).toBeNull();
    expect(leerCortesEscritos("veinte")).toBeNull();
  });
});

describe("picos", () => {
  // Mutación que la mata: no normalizar al pico más alto.
  it("un pico por cubo, normalizado a 1", () => {
    expect(picos(Float32Array.from([0.1, -0.2, 0.4, 0]), 2)).toEqual([0.5, 1]);
    expect(picos(new Float32Array(0), 10)).toEqual([]);
  });
});
