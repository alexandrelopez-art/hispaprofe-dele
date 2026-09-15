import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { mensajeDeError } from "@/lib/taller/ia/errores";

const cabeceras = new Headers();

describe("traducir los errores de la IA", () => {
  // Mutación que la mata: tratar el 401 como «no responde».
  it("una clave mala lo dice", () => {
    expect(mensajeDeError(new Anthropic.AuthenticationError(401, undefined, "x", cabeceras))).toBe("La clave de la IA no es válida. Revísala en Vercel.");
  });

  // Mutación que la mata: quitar RateLimitError de los «no responde».
  it("demasiadas llamadas, un fallo de Anthropic o sin conexión: prueba en un minuto", () => {
    const NO_RESPONDE = "La IA no responde ahora. Prueba en un minuto.";
    expect(mensajeDeError(new Anthropic.RateLimitError(429, undefined, "x", cabeceras))).toBe(NO_RESPONDE);
    expect(mensajeDeError(new Anthropic.InternalServerError(500, undefined, "x", cabeceras))).toBe(NO_RESPONDE);
    expect(mensajeDeError(new Anthropic.APIConnectionError({ message: "x" }))).toBe(NO_RESPONDE);
  });

  // Mutación que la mata: mensaje genérico para cualquier APIError.
  it("otro rechazo de la API dice su código", () => {
    expect(mensajeDeError(new Anthropic.BadRequestError(400, undefined, "x", cabeceras))).toBe("La IA rechazó la petición (400).");
  });

  // Mutación que la mata: relanzar lo que no es del SDK.
  it("lo que no es del SDK es una respuesta que no se entiende", () => {
    expect(mensajeDeError(new SyntaxError("Unexpected end of JSON"))).toBe("La IA devolvió algo que no es esta tarea.");
  });
});
