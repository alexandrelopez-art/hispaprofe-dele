"use client";

const ENTRADA = "w-full rounded-xl border p-3";

/** Un campo del taller. Vacío y obligatorio se pinta en amarillo: se ve qué falta sin leer los motivos. */
export function Campo({
  etiqueta,
  valor,
  alCambiar,
  largo = false,
  opcional = false,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  largo?: boolean;
  opcional?: boolean;
}) {
  const falta = !opcional && valor.trim() === "";
  const clases = `${ENTRADA} ${falta ? "border-sol-400 bg-sol-100" : "border-tinta-suave/30 bg-white"}`;
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
    </label>
  );
}

/** Una letra sola: la del ejemplo. */
export function Letra({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return <Campo etiqueta={etiqueta} valor={valor} alCambiar={(v) => alCambiar(v.trim().toUpperCase().slice(-1))} />;
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

export function Pautas({ etiqueta, pautas, alCambiar }: { etiqueta: string; pautas: string[]; alCambiar: (p: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold text-tinta-suave">{etiqueta}</legend>
      {pautas.map((pauta, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta={`Pauta ${i + 1}`} valor={pauta} alCambiar={(v) => alCambiar(pautas.map((p, j) => (j === i ? v : p)))} />
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

export function Numero({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: number | null; alCambiar: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-tinta-suave">{etiqueta} (opcional)</span>
      <input
        type="number"
        min={0}
        value={valor ?? ""}
        onChange={(e) => alCambiar(e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))))}
        className={`${ENTRADA} w-28 border-tinta-suave/30 bg-white`}
      />
    </label>
  );
}

export const CAJA = "flex min-w-0 flex-col gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4";
