// Vive fuera de asignar.ts para que la suite normal no arrastre el cliente de la base.

/** «Ana, Luis, Marta y 5 más»: con doce estudiantes, la lista entera no cabe en el aviso. */
export function listaDeNombres(nombres: string[]): string {
  if (nombres.length <= 3) {
    if (nombres.length <= 1) return nombres[0] ?? "";
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  }
  return `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
}
