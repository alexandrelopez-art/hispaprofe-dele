/**
 * Bitmap en RGBA con 4 bytes por píxel: la misma forma que `ImageData` del
 * navegador y la que devuelve `pngjs` en Node. Así la segmentación se
 * prueba en Node contra PNG reales y se usa sin cambios en el navegador.
 */
export type Lienzo = {
  readonly ancho: number;
  readonly alto: number;
  readonly datos: Uint8ClampedArray;
};

// Pesos de luminancia ITU-R BT.601: los mismos que usa cualquier decodificador a escala de grises.
const PESO_ROJO = 0.299;
const PESO_VERDE = 0.587;
const PESO_AZUL = 0.114;

/** Luminancia (0-255) del píxel (x, y). El canal alfa no importa: la página escaneada es opaca. */
export function luminancia(lienzo: Lienzo, x: number, y: number): number {
  const i = (lienzo.ancho * y + x) * 4;
  const { datos } = lienzo;
  return PESO_ROJO * datos[i] + PESO_VERDE * datos[i + 1] + PESO_AZUL * datos[i + 2];
}

/**
 * Por debajo de este umbral un píxel cuenta como "oscuro": tinta impresa
 * (texto, reglas, barras de cabecera/pie) o el borde de una caja. La sombra
 * del lomo de un libro escaneado se queda muy por encima (≈235 de
 * luminancia medida en el corpus), así que un único umbral separa tinta
 * real de sombra de papel sin necesitar dos constantes distintas.
 */
export const UMBRAL_LUMINANCIA_OSCURO = 200;

/** Si el píxel (x, y) cuenta como tinta impresa según `umbral`. */
export function esOscuro(lienzo: Lienzo, x: number, y: number, umbral: number = UMBRAL_LUMINANCIA_OSCURO): boolean {
  return luminancia(lienzo, x, y) < umbral;
}
