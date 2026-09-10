export const NOMBRE_DE_COOKIE = "hp_sesion";

const ABIERTAS = ["/entrar"];

/** Todo está cerrado menos la portada y las pantallas de entrar. */
export function exigeSesion(ruta: string): boolean {
  if (ruta === "/") return false;
  return !ABIERTAS.some((a) => ruta === a || ruta.startsWith(`${a}/`));
}
