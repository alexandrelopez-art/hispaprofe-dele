export type Ruta = ReadonlyArray<string | number>;
export type Cambiar = (ruta: Ruta, valor: unknown) => void;

/** Una copia de `objeto` con `valor` puesto en `ruta`. Lo que no está en la ruta se comparte, no se copia. */
export function cambiar<T>(objeto: T, ruta: Ruta, valor: unknown): T {
  if (ruta.length === 0) return valor as T;
  const [paso, ...resto] = ruta;
  if (Array.isArray(objeto)) {
    if (typeof paso !== "number") throw new Error(`Ruta inválida: se esperaba un índice y ha llegado «${String(paso)}».`);
    return objeto.map((x, i) => (i === paso ? cambiar(x, resto, valor) : x)) as T;
  }
  if (objeto === null || typeof objeto !== "object") throw new Error("Ruta inválida: no hay nada que cambiar ahí.");
  const registro = objeto as Record<string, unknown>;
  return { ...registro, [String(paso)]: cambiar(registro[String(paso)], resto, valor) } as T;
}
