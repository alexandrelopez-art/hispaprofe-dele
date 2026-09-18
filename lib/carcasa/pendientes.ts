import { cache } from "react";
import { escritosPorCorregir } from "@/lib/examen/corregir";

/** La cola de Pendientes de ESTA petición. En /pendientes la pide la cabecera
 *  (para el número) y la página (para la lista): una sola consulta. */
export const colaPorCorregir = cache(() => escritosPorCorregir(new Date()));

/**
 * Cuántas redacciones esperan corrección, para el número de la cabecera. Si la
 * cuenta falla devuelve null y la cabecera sale sin número: un número que no
 * se puede contar no puede tumbar todas las pantallas del profesor.
 */
export async function contarPendientes(): Promise<number | null> {
  try {
    return (await colaPorCorregir()).length;
  } catch (e) {
    console.error("No se pudo contar Pendientes para la cabecera:", e);
    return null;
  }
}
