import { z } from "zod";
import type { EstructuraDeNivel } from "@/lib/dele/estructura";
import type { Trozo } from "./trozos";

export type RespuestasDeUnaPrueba = Record<string, string>;
/** { "1": { CE: { "13": "B" }, CO: { ... } } } */
export type Soluciones = Record<string, { CE: RespuestasDeUnaPrueba; CO: RespuestasDeUnaPrueba }>;

/** Una acción de servidor corta a 1 MB; el cuadernillo del libro son unos 2.300 trozos. */
export const TOPE_DE_TROZOS = 10_000;

export const trozosSchema = z
  .array(
    z.strictObject({
      pagina: z.number().int().min(1),
      x: z.number(),
      y: z.number(),
      texto: z.string().max(2_000),
      anchoPagina: z.number().positive(),
    }),
  )
  .max(TOPE_DE_TROZOS);

/**
 * La tabla de SOLUCIONES del cuadernillo. Solo mira páginas con el trozo
 * «SOLUCIONES». Cada página lleva dos exámenes lado a lado: se parte por la
 * mitad del ancho y cada columna se lee de arriba abajo. La tarea de cada par
 * la dará su número (estructura del nivel), no el rótulo «TAREA N».
 */
export function leerSoluciones(trozos: readonly Trozo[]): Soluciones {
  const soluciones: Soluciones = {};
  const paginas = [...new Set(trozos.map((t) => t.pagina))].sort((a, b) => a - b);
  for (const pagina of paginas) {
    const suyos = trozos.filter((t) => t.pagina === pagina);
    if (!suyos.some((t) => t.texto.trim().toUpperCase() === "SOLUCIONES")) continue;
    for (const derecha of [false, true]) {
      const columna = suyos
        .filter((t) => t.x >= t.anchoPagina / 2 === derecha)
        .sort((a, b) => b.y - a.y || a.x - b.x);
      let examen: string | null = null;
      let prueba: "CE" | "CO" | null = null;
      for (const t of columna) {
        const s = t.texto.trim();
        const rotulo = s.match(/^EXAMEN\s+(\d+)$/i);
        if (rotulo) {
          examen = String(Number(rotulo[1]));
          soluciones[examen] ??= { CE: {}, CO: {} };
          prueba = null;
          continue;
        }
        if (/LECTURA$/i.test(s)) { prueba = "CE"; continue; }
        if (/AUDITIVA$/i.test(s)) { prueba = "CO"; continue; }
        const par = s.match(/^(\d+)\s*-\s*([A-J])$/i);
        if (par && examen && prueba) soluciones[examen][prueba][String(Number(par[1]))] = par[2].toUpperCase();
      }
    }
  }
  return soluciones;
}

export type FilaDelResumen = { tarea: number; primero: number; items: number; encontradas: number };
export type ResumenDeExamen = {
  examen: string;
  pruebas: { prueba: "CE" | "CO"; filas: FilaDelResumen[]; fuera: string[] }[];
  bien: boolean;
};

/** Lo que el taller enseña al subir el cuadernillo: cuántas respuestas de cada tarea ha encontrado. */
export function resumenDeSoluciones(soluciones: Soluciones, estructura: EstructuraDeNivel): ResumenDeExamen[] {
  const porNumero = (a: string, b: string) => Number(a) - Number(b);
  return Object.keys(soluciones).sort(porNumero).map((examen) => {
    const pruebas = (["CE", "CO"] as const).map((prueba) => {
      const respuestas = soluciones[examen][prueba];
      const dentro = new Set<string>();
      const filas = estructura[prueba]
        .filter((r) => r.items !== null && r.primero !== null)
        .map((r) => {
          let encontradas = 0;
          for (let n = r.primero!; n < r.primero! + r.items!; n++) {
            if (String(n) in respuestas) { encontradas++; dentro.add(String(n)); }
          }
          return { tarea: r.numero, primero: r.primero!, items: r.items!, encontradas };
        });
      const fuera = Object.keys(respuestas).filter((n) => !dentro.has(n)).sort(porNumero);
      return { prueba, filas, fuera };
    });
    const bien = pruebas.every((p) => p.fuera.length === 0 && p.filas.every((f) => f.encontradas === f.items));
    return { examen, pruebas, bien };
  });
}

/** El texto entero, por páginas y líneas. Lo usará la IA en la Entrega 2 (transcripciones). */
export function textoDeTrozos(trozos: readonly Trozo[]): string {
  const paginas = [...new Set(trozos.map((t) => t.pagina))].sort((a, b) => a - b);
  return paginas
    .map((pagina) => {
      const lineas = new Map<number, Trozo[]>();
      for (const t of trozos.filter((t) => t.pagina === pagina)) {
        const y = Math.round(t.y);
        lineas.set(y, [...(lineas.get(y) ?? []), t]);
      }
      return [...lineas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, suyos]) => suyos.sort((a, b) => a.x - b.x).map((t) => t.texto.trim()).join(" "))
        .join("\n");
    })
    .join("\n\n")
    .trim();
}
