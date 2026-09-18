import { BANDA_MAXIMA, CRITERIOS_EE } from "@/lib/dele/estructura";
import { enLista } from "@/components/examen/piezas";

/** Una nota por criterio. `null` = sin poner, que NO es un 0 (un 0 es una nota). */
export type Bandas = (number | null)[];

const fila = (bandas: Record<number, Bandas>, n: number): Bandas => bandas[n] ?? CRITERIOS_EE.map(() => null);

/** «18 de 24»: lo puesto hasta ahora sobre el máximo de todas. Solo informa:
 *  nunca se traduce a apto / no apto. */
export function sumaDeNotas(bandas: Record<number, Bandas>, numeros: number[]): { suma: number; maximo: number } {
  const suma = numeros.flatMap((n) => fila(bandas, n)).reduce<number>((s, b) => s + (b ?? 0), 0);
  return { suma, maximo: numeros.length * CRITERIOS_EE.length * BANDA_MAXIMA };
}

/** Por qué no se puede guardar todavía, o null si ya se puede. Va escrito al
 *  lado de los botones apagados: un botón apagado sin motivo parece roto. */
export function motivoParaNoGuardar(bandas: Record<number, Bandas>, numeros: number[]): string | null {
  const faltanPorTarea = numeros
    .map((n) => ({ n, faltan: fila(bandas, n).filter((b) => b === null).length }))
    .filter((t) => t.faltan > 0);
  if (faltanPorTarea.length === 0) return null;
  const total = faltanPorTarea.reduce((s, t) => s + t.faltan, 0);
  const cuantas = total === 1 ? "Te falta 1 nota" : `Te faltan ${total} notas`;
  const donde = faltanPorTarea.length === 1 ? `la tarea ${faltanPorTarea[0].n}` : `las tareas ${enLista(faltanPorTarea.map((t) => String(t.n)))}`;
  return `${cuantas} en ${donde}.`;
}
