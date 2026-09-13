/**
 * Los números de examen que trae un cuadernillo, para llenar el segundo
 * select del formulario «Cuadernillo de soluciones». Puro para poder
 * probarlo sin montar el componente: un id desconocido, o vacío (nada
 * elegido todavía), no tienen números que ofrecer.
 */
export function examenesDelCuadernillo(
  cuadernillos: readonly { id: string; examenes: readonly string[] }[],
  id: string,
): string[] {
  if (!id) return [];
  return [...(cuadernillos.find((c) => c.id === id)?.examenes ?? [])];
}
