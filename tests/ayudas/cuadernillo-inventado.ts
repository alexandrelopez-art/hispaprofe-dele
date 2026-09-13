// tests/ayudas/cuadernillo-inventado.ts
// Una tabla de SOLUCIONES con la misma forma que la del libro (dos exámenes
// por página, dos columnas de pares por examen) pero con letras INVENTADAS.
// El repo es público: nada del cuadernillo real puede entrar aquí.
import { ESTRUCTURAS, letrasHasta } from "@/lib/dele/estructura";
import type { Trozo } from "@/lib/taller/trozos";

export const ANCHO = 600;
const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

/** Da vueltas por las letras de la tarea; cambia con el examen para que dos exámenes no coincidan. */
export function letraInventada(examen: number, prueba: "CE" | "CO", n: number): string {
  const regla = ESCOLAR[prueba].find((r) => n >= r.primero! && n < r.primero! + r.items!)!;
  const letras = letrasHasta(regla.letras);
  return letras[(n * 7 + examen + (prueba === "CO" ? 1 : 0)) % letras.length];
}

/** Las líneas de un examen en su columna. `quitar` lleva «CE-19» y similares. */
export function lineasDeExamen(examen: number, quitar: string[] = []): string[][] {
  const lineas: string[][] = [[`EXAMEN ${examen}`]];
  const pruebas = [
    ["CE", "PRUEBA DE COMPRENSIÓN DE LECTURA"],
    ["CO", "PRUEBA DE COMPRENSIÓN AUDITIVA"],
  ] as const;
  for (const [prueba, rotulo] of pruebas) {
    lineas.push([rotulo]);
    for (const r of ESCOLAR[prueba]) {
      lineas.push([`TAREA ${r.numero}`]);
      const pares = Array.from({ length: r.items! }, (_, i) => r.primero! + i)
        .filter((n) => !quitar.includes(`${prueba}-${n}`))
        .map((n) => `${n}-${letraInventada(examen, prueba, n)}`);
      const mitad = Math.ceil(pares.length / 2);
      for (let i = 0; i < mitad; i++) lineas.push(pares[i + mitad] ? [pares[i], pares[i + mitad]] : [pares[i]]);
    }
  }
  return lineas;
}

/** Una página de soluciones: SOLUCIONES arriba y dos exámenes lado a lado, a la misma altura. */
export function paginaDeSoluciones(pagina: number, izquierda: string[][], derecha: string[][]): Trozo[] {
  const trozos: Trozo[] = [{ pagina, x: 50, y: 800, texto: "SOLUCIONES", anchoPagina: ANCHO }];
  const poner = (lineas: string[][], x0: number) =>
    lineas.forEach((linea, i) =>
      linea.forEach((texto, j) => trozos.push({ pagina, x: x0 + j * 108, y: 786 - i * 14, texto, anchoPagina: ANCHO })),
    );
  poner(izquierda, 50);
  poner(derecha, 304);
  return trozos;
}
