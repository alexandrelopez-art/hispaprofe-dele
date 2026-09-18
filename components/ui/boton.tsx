import type { ButtonHTMLAttributes } from "react";

export type Variante = "principal" | "secundario" | "peligro";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const POR_VARIANTE: Record<Variante, string> = {
  principal: "bg-hp-700 text-white hover:bg-hp-600",
  secundario: "border border-hp-300 bg-white text-hp-600 hover:bg-hp-50",
  peligro: "bg-coral-600 text-white hover:bg-coral-500",
};

/** Las clases de un botón, para lo que tiene que parecerlo sin serlo (un enlace). */
export function clasesDeBoton(variante: Variante = "principal"): string {
  return `${BASE} ${POR_VARIANTE[variante]}`;
}

/**
 * Mientras envía se apaga y cambia el texto por lo que está haciendo: un botón
 * que sigue encendido invita al segundo clic, y uno que se apaga sin decir nada
 * parece roto.
 */
export function Boton({
  variante = "principal",
  enviando = false,
  textoEnviando,
  className = "",
  type = "button",
  disabled,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; enviando?: boolean; textoEnviando?: string }) {
  return (
    <button
      {...resto}
      type={type}
      disabled={disabled || enviando}
      aria-busy={enviando || undefined}
      className={`${clasesDeBoton(variante)} ${className}`.trim()}
    >
      {enviando && textoEnviando ? textoEnviando : children}
    </button>
  );
}
