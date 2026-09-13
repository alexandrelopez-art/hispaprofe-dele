export type EstadoDePagina = {
  nombre: string;
  estado: "PENDIENTE" | "SUBIENDO" | "SUBIDA" | "FALLIDA";
  ficheroId: string | null;
  error: string | null;
};

/** Los ids en el orden del PDF, o null si alguna página no ha llegado. El orden es la posición, nunca la llegada. */
export function idsEnOrden(paginas: readonly EstadoDePagina[]): string[] | null {
  if (paginas.length === 0) return null;
  const ids: string[] = [];
  for (const p of paginas) {
    if (p.estado !== "SUBIDA" || !p.ficheroId) return null;
    ids.push(p.ficheroId);
  }
  return ids;
}
