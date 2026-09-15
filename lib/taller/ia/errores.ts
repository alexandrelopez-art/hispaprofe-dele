import Anthropic from "@anthropic-ai/sdk";

const TIMEOUT = "La IA tardó demasiado. Prueba otra vez o reparte las hojas.";
const NO_RESPONDE = "La IA no responde ahora. Prueba en un minuto.";

export function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "La clave de la IA no es válida. Revísala en Vercel.";
  if (
    e instanceof Anthropic.APIUserAbortError ||
    e instanceof Anthropic.APIConnectionTimeoutError ||
    (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
  ) {
    return TIMEOUT;
  }
  if (
    e instanceof Anthropic.RateLimitError ||
    e instanceof Anthropic.InternalServerError ||
    e instanceof Anthropic.APIConnectionError
  ) {
    return NO_RESPONDE;
  }
  if (e instanceof Anthropic.APIError && (e.status === undefined || e.status === 529)) return NO_RESPONDE;
  if (e instanceof Anthropic.APIError) return `La IA rechazó la petición (${e.status}).`;
  return "La IA devolvió algo que no es esta tarea.";
}
