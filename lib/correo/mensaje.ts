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
<p style="color:#5a7a8c;font-size:12px">${url}</p>`;

  return { a, asunto: "Tu entrada a HispaProfe", texto, html };
}
