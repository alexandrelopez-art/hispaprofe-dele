import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "w-full rounded-2xl border border-tinta-suave/30 bg-white px-3 py-2 text-tinta " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hp-600 " +
  "aria-[invalid=true]:border-error-500";

type Comun = { id: string; etiqueta: string; ayuda?: string; error?: string };
type ComoInput = Comun & { multilinea?: false } & InputHTMLAttributes<HTMLInputElement>;
type ComoTexto = Comun & { multilinea: true } & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Las claves propias de Campo: no son atributos del <input>/<textarea> real,
 *  así que no deben llegar hasta él. Un `delete` por clave evita destructurar
 *  variables que nadie usa (el plan las llamaba `_i`, `_e`…) solo para
 *  descartarlas. */
function sinPropiasDeCampo<T extends Comun & { multilinea?: boolean; className?: string }>(
  props: T,
): Omit<T, "id" | "etiqueta" | "ayuda" | "error" | "multilinea" | "className"> {
  const copia: Record<string, unknown> = { ...props };
  delete copia.id;
  delete copia.etiqueta;
  delete copia.ayuda;
  delete copia.error;
  delete copia.multilinea;
  delete copia.className;
  return copia as Omit<T, "id" | "etiqueta" | "ayuda" | "error" | "multilinea" | "className">;
}

export function Campo(props: ComoInput | ComoTexto) {
  const { id, etiqueta, ayuda, error, className = "" } = props;
  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const aria = { "aria-describedby": describe, "aria-invalid": error ? true : undefined };
  let control;
  if (props.multilinea) {
    const resto = sinPropiasDeCampo(props);
    control = <textarea {...resto} {...aria} id={id} className={`${CONTROL} ${className}`.trim()} />;
  } else {
    const resto = sinPropiasDeCampo(props);
    control = <input {...resto} {...aria} id={id} className={`${CONTROL} ${className}`.trim()} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {etiqueta}
      </label>
      {control}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-sm text-tinta-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-bold text-error-600">
          {error}
        </p>
      )}
    </div>
  );
}
