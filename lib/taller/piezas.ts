import type { TipoActividad, TipoPieza } from "@/lib/generated/prisma";
import { TIPO_DE_ACTIVIDAD, formularioBase, type Formulario } from "./formas";

export const ETIQUETA_DE_CONSIGNA = "consigna";

export type PiezaParaGuardar = {
  orden: number;
  tipo: Extract<TipoPieza, "TEXTO" | "AUDIO" | "ACTIVIDAD">;
  texto: string | null;
  etiqueta: string | null;
  ficheroId: string | null;
  cortes: number[];
  actividad: { tipo: TipoActividad; datos: Record<string, unknown> } | null;
};

export type PiezaLeida = {
  orden: number;
  tipo: TipoPieza;
  texto: string | null;
  etiqueta: string | null;
  ficheroId: string | null;
  cortes: number[];
  actividad: { datos: unknown } | null;
};

const SIN_FICHERO = { ficheroId: null, cortes: [] };

/**
 * Una tarea del taller en la lista de piezas del modelo: la consigna, los
 * textos sueltos, la pista si la hay y una actividad. Las fotos van en los
 * datos de la actividad, por clave. Las respuestas NO van aquí: van en Clave.
 */
export function piezasDelFormulario(f: Formulario): PiezaParaGuardar[] {
  const audio: PiezaParaGuardar[] = f.medios.audio
    ? [{ orden: f.textos.length + 1, tipo: "AUDIO", texto: null, etiqueta: null, ficheroId: f.medios.audio.fichero, cortes: f.medios.audio.cortes, actividad: null }]
    : [];
  return [
    { orden: 0, tipo: "TEXTO", texto: f.consigna, etiqueta: ETIQUETA_DE_CONSIGNA, ...SIN_FICHERO, actividad: null },
    ...f.textos.map((t, i) => ({
      orden: i + 1,
      tipo: "TEXTO" as const,
      texto: t.texto,
      etiqueta: t.etiqueta,
      ...SIN_FICHERO,
      actividad: null,
    })),
    ...audio,
    {
      orden: f.textos.length + 1 + audio.length,
      tipo: "ACTIVIDAD",
      texto: null,
      etiqueta: null,
      ...SIN_FICHERO,
      actividad: { tipo: TIPO_DE_ACTIVIDAD[f.forma], datos: { forma: f.forma, ...f.actividad, imagenes: f.medios.imagenes } },
    },
  ];
}

/**
 * El contrato de entrada de `formularioDePiezas`, como se le pide a Prisma:
 * exactamente los campos que esa función lee, ni uno más. Es lo que hay que
 * poner en `select` en cualquier consulta que luego la llame.
 *
 * Está aquí, al lado de la función, y no copiado a mano en cada consulta, por
 * dos razones. La primera: copiado en tres sitios (paraHacer, hacer, corregir)
 * eran tres sitios donde olvidar un campo al añadirlo, y un campo que falta
 * hace que `formularioDePiezas` devuelva null y que la tarea desaparezca de la
 * pantalla sin decir por qué. La segunda, y la que importa: esta lista es
 * también lo que GARANTIZA que la clave del examen no viaja. `Clave` cuelga de
 * la actividad, y al pedir campo a campo no hay forma de que se cuele; un
 * `include` en su lugar se la llevaría entera al navegador del estudiante.
 */
export const SELECT_DE_PIEZAS = { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } } as const;

/** Lo contrario. null si la tarea no se guardó nunca o si lo guardado ya no casa con ninguna forma. */
export function formularioDePiezas(piezas: readonly PiezaLeida[]): Formulario | null {
  const ordenadas = [...piezas].sort((a, b) => a.orden - b.orden);
  const datos = ordenadas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.datos;
  if (!datos || typeof datos !== "object") return null;
  // Lo guardado antes de la Entrega 3a no trae `imagenes`: se lee como ninguna foto.
  const { forma, imagenes, ...actividad } = datos as Record<string, unknown>;
  const textos = ordenadas.filter((p) => p.tipo === "TEXTO");
  const pista = ordenadas.find((p) => p.tipo === "AUDIO");
  const leido = formularioBase.safeParse({
    forma,
    consigna: textos[0]?.orden === 0 ? (textos[0].texto ?? "") : "",
    textos: textos.filter((p) => p.orden > 0).map((p) => ({ etiqueta: p.etiqueta ?? "", texto: p.texto ?? "" })),
    medios: {
      imagenes: imagenes ?? {},
      audio: pista?.ficheroId ? { fichero: pista.ficheroId, cortes: pista.cortes } : null,
    },
    actividad,
  });
  return leido.success ? leido.data : null;
}
