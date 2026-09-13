/** Pone o quita una etiqueta y devuelve las marcadas en el orden del examen. */
export function alternarEtiqueta(todas: readonly string[], marcadas: readonly string[], etiqueta: string): string[] {
  const nuevas = marcadas.includes(etiqueta) ? marcadas.filter((e) => e !== etiqueta) : [...marcadas, etiqueta];
  return todas.filter((e) => nuevas.includes(e));
}
