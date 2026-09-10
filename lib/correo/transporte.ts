import nodemailer from "nodemailer";
import type { Mandar } from "@/lib/correo/mensaje";

function exigir(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Sin ella no se pueden mandar los ` +
        "enlaces de entrada y nadie puede entrar al sitio.",
    );
  }
  return valor;
}

/**
 * Manda por el SMTP de Gmail de ips@ips-hyl.com, poniendo como remitente el alias
 * contacto@hispaprofe.com. El alias no es una cuenta con contraseña propia: tiene
 * que estar dado de alta en «Enviar como» de esa cuenta, y la contraseña es una de
 * aplicación, distinta de la que usa la otra plataforma con la misma cuenta.
 */
export const mandarPorSmtp: Mandar = async (mensaje) => {
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: exigir("CORREO_USUARIO"), pass: exigir("CORREO_CONTRASENA") },
  });
  await transporte.sendMail({
    from: `HispaProfe <${exigir("CORREO_REMITENTE")}>`,
    to: mensaje.a,
    subject: mensaje.asunto,
    text: mensaje.texto,
    html: mensaje.html,
  });
};
