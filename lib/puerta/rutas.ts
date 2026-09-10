export const NOMBRE_DE_COOKIE = "hp_sesion";

const ABIERTAS = ["/", "/entrar"];

/** Todo está cerrado menos la portada y las pantallas de entrar. */
export function exigeSesion(ruta: string): boolean {
  return !ABIERTAS.some((abierta) => ruta === abierta || ruta.startsWith(`${abierta}/`));
}
