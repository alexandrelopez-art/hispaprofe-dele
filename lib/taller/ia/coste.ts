export type Uso = { entrada: number; cacheLeidos: number; cacheEscritos: number; salida: number };

export const SIN_USO: Uso = { entrada: 0, cacheLeidos: 0, cacheEscritos: 0, salida: 0 };

// Tarifas de claude-opus-5 en milésimas de dólar POR TOKEN: 5 $ el millón de
// entrada son 0,005 milésimas por token. Leer caché va al 10 % de la entrada y
// escribirla al 125 %. Es una estimación: si responde el modelo de respaldo, la
// factura manda.
const TARIFA = { entrada: 0.005, cacheLeidos: 0.0005, cacheEscritos: 0.00625, salida: 0.025 } as const;

export function costeEnMilesimas(uso: Uso): number {
  return Math.round(
    uso.entrada * TARIFA.entrada +
      uso.cacheLeidos * TARIFA.cacheLeidos +
      uso.cacheEscritos * TARIFA.cacheEscritos +
      uso.salida * TARIFA.salida,
  );
}

export function textoDelGasto(gasto: { llamadas: number; milesimas: number }): string | null {
  if (gasto.llamadas === 0) return null;
  const dolares = (gasto.milesimas / 1000).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `IA: ${dolares} $ en ${gasto.llamadas} ${gasto.llamadas === 1 ? "llamada" : "llamadas"}`;
}
