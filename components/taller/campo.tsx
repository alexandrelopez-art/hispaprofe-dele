"use client";

import type { Ruta } from "@/lib/taller/editar";
import { claveDeRuta } from "@/lib/taller/ia/dudas";
import { useDuda } from "./dudas";

const ENTRADA = "w-full rounded-xl border p-3";

/** Un campo del taller. Vacío y obligatorio, o con duda de la IA, se pinta en amarillo. */
export function Campo({
  etiqueta,
  valor,
  alCambiar,
  ruta,
  largo = false,
  opcional = false,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** La misma ruta que se pasa a `cambiar`: con ella se encuentra su duda. */
  ruta: Ruta;
  largo?: boolean;
  opcional?: boolean;
}) {
  const duda = useDuda(ruta);
  const falta = !opcional && valor.trim() === "";
  const clases = `${ENTRADA} ${falta || duda ? "border-sol-400 bg-sol-100" : "border-tinta-suave/30 bg-white"}`;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-tinta-suave">
        {etiqueta}
        {opcional ? " (opcional)" : ""}
      </span>
      {largo ? (
        <textarea value={valor} onChange={(e) => alCambiar(e.target.value)} rows={5} className={clases} />
      ) : (
        <input type="text" value={valor} onChange={(e) => alCambiar(e.target.value)} className={clases} />
      )}
      {duda && <span data-duda={claveDeRuta(ruta)} className="text-sm text-tinta-suave">La IA duda: {duda}</span>}
    </label>
  );
}

/** Una letra sola: la del ejemplo. */
export function Letra({ etiqueta, valor, alCambiar, ruta }: { etiqueta: string; valor: string; alCambiar: (v: string) => void; ruta: Ruta }) {
  return <Campo etiqueta={etiqueta} valor={valor} alCambiar={(v) => alCambiar(v.trim().toUpperCase().slice(-1))} ruta={ruta} />;
}

/** La respuesta del cuadernillo: se enseña y no se edita. */
export function Respuesta({ numero, respuestas }: { numero: number; respuestas: Record<string, string> | null }) {
  const letra = respuestas?.[String(numero)];
  return (
    <span
      data-respuesta={numero}
      className={`rounded-full px-3 py-1 text-sm font-bold ${letra ? "bg-verde-100 text-verde-600" : "bg-error-100 text-error-600"}`}
    >
      {letra ? `Respuesta del cuadernillo: ${letra}` : "Sin respuesta en el cuadernillo"}
    </span>
  );
}

export function Pautas({ etiqueta, pautas, alCambiar, ruta }: { etiqueta: string; pautas: string[]; alCambiar: (p: string[]) => void; ruta: Ruta }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold text-tinta-suave">{etiqueta}</legend>
      {pautas.map((pauta, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta={`Pauta ${i + 1}`} valor={pauta} alCambiar={(v) => alCambiar(pautas.map((p, j) => (j === i ? v : p)))} ruta={[...ruta, i]} />
          </div>
          <button type="button" onClick={() => alCambiar(pautas.filter((_, j) => j !== i))} className="rounded-xl border border-tinta-suave/30 px-3 py-2">
            Quitar
          </button>
        </div>
      ))}
      {pautas.length < 12 && (
        <button type="button" onClick={() => alCambiar([...pautas, ""])} className="self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
          Añadir pauta
        </button>
      )}
    </fieldset>
  );
}

export function Numero({ etiqueta, valor, alCambiar, ruta }: { etiqueta: string; valor: number | null; alCambiar: (v: number | null) => void; ruta: Ruta }) {
  const duda = useDuda(ruta);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-tinta-suave">{etiqueta} (opcional)</span>
      <input
        type="number"
        min={0}
        value={valor ?? ""}
        onChange={(e) => alCambiar(e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))))}
        className={`${ENTRADA} w-28 ${duda ? "border-sol-400 bg-sol-100" : "border-tinta-suave/30 bg-white"}`}
      />
      {duda && <span data-duda={claveDeRuta(ruta)} className="text-sm text-tinta-suave">La IA duda: {duda}</span>}
    </label>
  );
}

export const CAJA = "flex min-w-0 flex-col gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4";
