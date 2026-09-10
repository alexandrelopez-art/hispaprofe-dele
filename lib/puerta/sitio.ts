/**
 * De dónde sale la dirección del sitio para componer el enlace de entrada.
 *
 * NO se saca de la cabecera `host` cuando falta la variable de entorno: esa
 * cabecera la pone quien llama, no el servidor. Sin SITIO_URL, alguien podría
 * pedir un enlace para el correo de otra persona con una cabecera `host` falsa
 * y conseguir que el enlace que llega a ese buzón apunte a un dominio suyo,
 * con un secreto válido dentro; si la persona lo pulsa, el secreto se lo
 * lleva quien mandó la petición falsa. En producción, sin SITIO_URL, no se
 * compone ningún enlace: se revienta.
 */
export function direccionDelSitio(cabeceras: Headers): string {
  const declarada = process.env.SITIO_URL;
  if (declarada) return declarada.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta la variable de entorno SITIO_URL. Sin ella no se puede componer el " +
        "enlace de entrada, y la cabecera de la petición no es de fiar.",
    );
  }
  return `http://${cabeceras.get("host") ?? "localhost:3000"}`;
}
