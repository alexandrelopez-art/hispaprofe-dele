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
 * Con `IA_PROVEEDOR=ocr` el taller lee las hojas en la propia máquina y no
 * llama a nadie. Sin la variable se sigue usando Claude, que es lo que
 * había: un despliegue que ya funciona no cambia de comportamiento solo por
 * desplegar esto.
 *
 * Vive aquí y no junto al lector local porque la pantalla de la tarea la
 * necesita, y ese módulo arrastra los lectores de forma y, tras ellos, la
 * base de datos: la pantalla no puede pagar eso solo para encender un botón.
 */
export function usaLectorLocal(): boolean {
  return process.env.IA_PROVEEDOR === "ocr";
}

/** El lector local no necesita clave: para encender el botón basta con que haya uno de los dos. */
export function hayLector(): boolean {
  return usaLectorLocal() || hayClaveDeIA();
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
  // El SDK valida la salida con Zod dentro de betaZodOutputFormat: si rechaza,
  // finalMessage() lanza y la llamada se apunta a coste 0 sin que el profesor
  // sepa que la IA sí respondió. Se manda el mismo esquema como JSON Schema
  // suelto para que el SDK no valide nada: interpretar() hace su propia
  // validación con safeParse, que sí sabe traducir el fallo al profesor.
  const { schema } = betaZodOutputFormat(esquemaDeRespuesta(encargo.forma));
  const flujo = cliente.beta.messages.stream(
    {
      model: MODELO,
      max_tokens: 20_000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema } },
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
    },
    { signal: AbortSignal.timeout(270_000) },
  );
  const mensaje = await flujo.finalMessage();
  const bloqueDeTexto = mensaje.content.find((b) => b.type === "text");
  let salida: unknown = null;
  if (bloqueDeTexto) {
    try {
      salida = JSON.parse(bloqueDeTexto.text);
    } catch {
      salida = null;
    }
  }
  return {
    salida,
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
