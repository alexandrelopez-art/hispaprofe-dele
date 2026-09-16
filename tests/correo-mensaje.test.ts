import { describe, it, expect } from "vitest";
import { mensajeDeAsignacion, mensajeDeEntrada } from "@/lib/correo/mensaje";

const URL_DE_ENTRADA = "https://hispaprofe.com/entrar/abc123";

describe("el correo de entrada", () => {
  it("lleva el enlace entero, en el texto y en el html", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.texto).toContain(URL_DE_ENTRADA);
    expect(mensaje.html).toContain(URL_DE_ENTRADA);
  });

  it("dice cuánto dura, porque quince minutos sorprenden a cualquiera", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.texto).toContain("quince minutos");
  });

  it("va dirigido a quien lo pidió y en español", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.a).toBe("ana@ejemplo.com");
    expect(mensaje.asunto).toBe("Tu entrada a HispaProfe");
  });
});

describe("el aviso de examen asignado", () => {
  const datos = {
    nombre: "Ana",
    titulo: "Examen 1",
    nivel: "A2/B1 escolar",
    fechaEnPalabras: "martes, 20 de octubre de 2026",
    url: "https://hispaprofe-dele.vercel.app",
  };

  // Mutación que la mata: dejar de interpolar el título o la fecha. Un aviso sin
  // fecha obliga a preguntar por WhatsApp, que es justo lo que evita el correo.
  it("dice de qué examen y para cuándo, en el asunto y en el cuerpo", () => {
    const mensaje = mensajeDeAsignacion("ana@ejemplo.com", datos);

    expect(mensaje.a).toBe("ana@ejemplo.com");
    expect(mensaje.asunto).toBe("Tienes un examen: Examen 1");
    for (const parte of [mensaje.texto, mensaje.html]) {
      expect(parte).toContain("Ana");
      expect(parte).toContain("Examen 1");
      expect(parte).toContain(datos.nivel);
      expect(parte).toContain("martes, 20 de octubre de 2026");
      expect(parte).toContain("https://hispaprofe-dele.vercel.app");
    }
  });

  // Mutación que la mata: reutilizar aquí el enlace de un solo uso de
  // mensajeDeEntrada. Ese caduca a los quince minutos y se gasta al primer clic
  // (hasta el antivirus del correo lo gasta), así que el aviso llegaría roto.
  it("el enlace es la portada, no un enlace de entrada", () => {
    const mensaje = mensajeDeAsignacion("ana@ejemplo.com", datos);

    expect(mensaje.texto).not.toContain("/entrar/");
    expect(mensaje.texto).not.toContain("quince minutos");
  });

  // Mutación que la mata: quitar la llamada a escaparHtml de la interpolación
  // del título. Sin escape, un & o < en el título rompería el marcado del correo.
  it("escapa caracteres especiales en el HTML pero no en el texto plano", () => {
    const datosConCaracteresEspeciales = {
      ...datos,
      titulo: "Examen 1 & 2 <escolar>",
    };
    const mensaje = mensajeDeAsignacion(
      "ana@ejemplo.com",
      datosConCaracteresEspeciales
    );

    // En el texto plano, los caracteres especiales van sin escapar
    expect(mensaje.texto).toContain("Examen 1 & 2 <escolar>");

    // En el HTML, están escapados
    expect(mensaje.html).toContain("&amp;");
    expect(mensaje.html).toContain("&lt;");
    expect(mensaje.html).not.toContain("Examen 1 & 2 <escolar>");
  });
});
