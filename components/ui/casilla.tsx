import type { InputHTMLAttributes } from "react";

export function Casilla({
  id,
  etiqueta,
  ...resto
}: { id: string; etiqueta: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2">
      <input
        {...resto}
        id={id}
        type="checkbox"
        className="size-4 accent-hp-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600"
      />
      <span>{etiqueta}</span>
    </label>
  );
}
