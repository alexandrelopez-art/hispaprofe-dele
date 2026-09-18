import type { SelectHTMLAttributes } from "react";

export function Desplegable({
  id,
  etiqueta,
  opciones,
  className = "",
  ...resto
}: { id: string; etiqueta: string; opciones: { valor: string; texto: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {etiqueta}
      </label>
      <select
        {...resto}
        id={id}
        className={`rounded-2xl border border-tinta-suave/30 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hp-600 ${className}`.trim()}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
