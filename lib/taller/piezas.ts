import type { TipoActividad, TipoPieza } from "@/lib/generated/prisma";
import { TIPO_DE_ACTIVIDAD, formularioBase, type Formulario } from "./formas";

export const ETIQUETA_DE_CONSIGNA = "consigna";

export type PiezaParaGuardar = {
  orden: number;
  tipo: Extract<TipoPieza, "TEXTO" | "ACTIVIDAD">;
  texto: string | null;
  etiqueta: string | null;
  actividad: { tipo: TipoActividad; datos: Record<string, unknown> } | null;
};

export type PiezaLeida = {
  orden: number;
  tipo: TipoPieza;
  texto: string | null;
  etiqueta: string | null;
  actividad: { datos: unknown } | null;
};

/**
 * Una tarea del taller en la lista de piezas del modelo: la consigna, los
 * textos sueltos y una actividad. Las respuestas NO van aquí: van en Clave.
 */
export function piezasDelFormulario(f: Formulario): PiezaParaGuardar[] {
  return [
    { orden: 0, tipo: "TEXTO", texto: f.consigna, etiqueta: ETIQUETA_DE_CONSIGNA, actividad: null },
    ...f.textos.map((t, i) => ({
      orden: i + 1,
      tipo: "TEXTO" as const,
      texto: t.texto,
      etiqueta: t.etiqueta,
      actividad: null,
    })),
    {
      orden: f.textos.length + 1,
      tipo: "ACTIVIDAD",
      texto: null,
      etiqueta: null,
      actividad: { tipo: TIPO_DE_ACTIVIDAD[f.forma], datos: { forma: f.forma, ...f.actividad } },
    },
  ];
}

/** Lo contrario. null si la tarea no se guardó nunca o si lo guardado ya no casa con ninguna forma. */
export function formularioDePiezas(piezas: readonly PiezaLeida[]): Formulario | null {
  const ordenadas = [...piezas].sort((a, b) => a.orden - b.orden);
  const datos = ordenadas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.datos;
  if (!datos || typeof datos !== "object") return null;
  const { forma, ...actividad } = datos as Record<string, unknown>;
  const textos = ordenadas.filter((p) => p.tipo === "TEXTO");
  const leido = formularioBase.safeParse({
    forma,
    consigna: textos[0]?.orden === 0 ? (textos[0].texto ?? "") : "",
    textos: textos.filter((p) => p.orden > 0).map((p) => ({ etiqueta: p.etiqueta ?? "", texto: p.texto ?? "" })),
    actividad,
  });
  return leido.success ? leido.data : null;
}
