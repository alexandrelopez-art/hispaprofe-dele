import { escritosPorCorregir } from "@/lib/examen/corregir";

/**
 * Cuántas redacciones esperan corrección, para el número de la cabecera. Si la
 * cuenta falla devuelve null y la cabecera sale sin número: un número que no
 * se puede contar no puede tumbar todas las pantallas del profesor.
 */
export async function contarPendientes(): Promise<number | null> {
  try {
    return (await escritosPorCorregir(new Date())).length;
  } catch (e) {
    console.error("No se pudo contar Pendientes para la cabecera:", e);
    return null;
  }
}
