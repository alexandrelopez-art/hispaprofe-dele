import { describe, it, expect } from "vitest";
import { mensajeDeEntrada } from "@/lib/correo/mensaje";

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
