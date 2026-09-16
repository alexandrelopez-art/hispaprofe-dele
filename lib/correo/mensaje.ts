export type Mensaje = { a: string; asunto: string; texto: string; html: string };
export type Mandar = (mensaje: Mensaje) => Promise<void>;

export function mensajeDeEntrada(a: string, url: string): Mensaje {
  const texto = [
    "Hola,",
    "",
    "Pulsa este enlace para entrar en HispaProfe:",
    url,
    "",
    "El enlace vale quince minutos y una sola vez. Si caduca, pide otro.",
    "Si no has sido tú, no hagas nada: sin pulsar el enlace no entra nadie.",
  ].join("\n");

  const html = `<p>Hola,</p>
<p><a href="${url}">Entrar en HispaProfe</a></p>
<p>El enlace vale quince minutos y una sola vez. Si caduca, pide otro.</p>
<p>Si no has sido tú, no hagas nada: sin pulsar el enlace no entra nadie.</p>
<p style="color:#5a7a8c;font-size:12px">
${url}
</p>`;

  return { a, asunto: "Tu entrada a HispaProfe", texto, html };
}

export type DatosDeAsignacion = {
  nombre: string;
  titulo: string;
  nivel: string;
  fechaEnPalabras: string;
  url: string;
};

/**
 * El enlace es la portada, NO un enlace de entrada: los de entrada caducan a los
 * quince minutos y se gastan al primer clic, así que un aviso que lo llevara
 * llegaría roto casi siempre. Quien pulse, si no tiene la sesión abierta, pasará
 * por la puerta como cualquier otro día.
 */
export function mensajeDeAsignacion(a: string, datos: DatosDeAsignacion): Mensaje {
  const { nombre, titulo, nivel, fechaEnPalabras, url } = datos;
  const texto = [
    `Hola, ${nombre}.`,
    "",
    `Tienes un examen para hacer: ${titulo} (${nivel}).`,
    `Fecha tope: ${fechaEnPalabras}.`,
    "",
    "Entra aquí cuando quieras:",
    url,
  ].join("\n");

  const html = `<p>Hola, ${nombre}.</p>
<p>Tienes un examen para hacer: <strong>${titulo}</strong> (${nivel}).</p>
<p>Fecha tope: ${fechaEnPalabras}.</p>
<p><a href="${url}">Entrar en HispaProfe</a></p>`;

  return { a, asunto: `Tienes un examen: ${titulo}`, texto, html };
}
