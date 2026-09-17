"use client";

import { palabras } from "@/lib/examen/motor";

export type Rango = { min: number | null; max: number | null };

/**
 * El aviso de debajo del folio. Avisa por arriba Y por abajo: quedarse corto
 * es el fallo más común del examen. Es un aviso, no un candado — pasarse de
 * palabras lo penaliza el examen, no la máquina.
 */
export function avisoDePalabras(cuantas: number, rango: Rango): { texto: string; pasada: boolean } {
  const cuenta = `${cuantas} ${cuantas === 1 ? "palabra" : "palabras"}`;
  if (rango.min === null && rango.max === null) return { texto: cuenta, pasada: false };
  const piden =
    rango.min !== null && rango.max !== null ? `entre ${rango.min} y ${rango.max}`
    : rango.min !== null ? `al menos ${rango.min}`
    : `como mucho ${rango.max}`;
  const pasada = (rango.max !== null && cuantas > rango.max) || (rango.min !== null && cuantas < rango.min);
  return { texto: `${cuenta} (te piden ${piden})`, pasada };
}

export function Folio({
  texto, rango, bloqueado, alEscribir,
}: {
  texto: string;
  rango: Rango;
  bloqueado: boolean;
  alEscribir: (texto: string) => void;
}) {
  const aviso = avisoDePalabras(palabras(texto), rango);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <textarea
        value={texto}
        disabled={bloqueado}
        onChange={(e) => alEscribir(e.target.value)}
        rows={16}
        className="w-full rounded-2xl border border-tinta-suave/30 p-4 leading-relaxed disabled:bg-tinta-suave/5"
        placeholder="Escribe aquí."
      />
      <p className={aviso.pasada ? "text-sm font-bold text-error-600" : "text-sm text-tinta-suave"}>{aviso.texto}</p>
    </div>
  );
}
