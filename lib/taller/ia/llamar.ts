import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Uso } from "./coste";
import { esquemaDeRespuesta, type Encargo } from "./encargo";

export const MODELO = "claude-opus-5";

export type RespuestaDeLaIA = { salida: unknown; stopReason: string | null; modelo: string; uso: Uso };
export type LeerHojas = (encargo: Encargo) => Promise<RespuestaDeLaIA>;

export function hayClaveDeIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Una tarea, una llamada. Razonamiento adaptativo encendido y salida con
 * esquema obligatorio: Opus 5 con el razonamiento apagado a veces escribe la
 * llamada en el texto en vez de devolverla. En flujo, para que no la corte un
 * tiempo de espera; `finalMessage()` junta el mensaje entero. El respaldo del
 * servidor termina la llamada con otro modelo si Opus 5 la rechaza.
 */
export const leerConClaude: LeerHojas = async (encargo) => {
  const cliente = new Anthropic();
  const flujo = cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: 32_000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(esquemaDeRespuesta(encargo.forma)) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: encargo.system, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...encargo.hojas.map((h) => ({ type: "image" as const, source: { type: "base64" as const, media_type: h.tipo, data: h.datos } })),
          { type: "text" as const, text: encargo.texto },
        ],
      },
    ],
  });
  const mensaje = await flujo.finalMessage();
  return {
    salida: mensaje.parsed_output ?? null,
    stopReason: mensaje.stop_reason,
    modelo: mensaje.model,
    uso: {
      entrada: mensaje.usage.input_tokens,
      cacheLeidos: mensaje.usage.cache_read_input_tokens ?? 0,
      cacheEscritos: mensaje.usage.cache_creation_input_tokens ?? 0,
      salida: mensaje.usage.output_tokens,
    },
  };
};
