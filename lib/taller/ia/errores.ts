import Anthropic from "@anthropic-ai/sdk";

export function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "La clave de la IA no es válida. Revísala en Vercel.";
  if (
    e instanceof Anthropic.RateLimitError ||
    e instanceof Anthropic.InternalServerError ||
    e instanceof Anthropic.APIConnectionError
  ) {
    return "La IA no responde ahora. Prueba en un minuto.";
  }
  if (e instanceof Anthropic.APIError) return `La IA rechazó la petición (${e.status}).`;
  return "La IA devolvió algo que no es esta tarea.";
}
