import type { ReactNode } from "react";

/** «aviso» es coral y es para lo que no es un fallo (llegar tarde, una cita
 *  no preparada); «error» es solo para fallos de verdad. */
export type Tono = "info" | "exito" | "aviso" | "error";

export const COLORES_DE_TONO: Record<Tono, string> = {
  info: "border-hp-200 bg-hp-50 text-hp-700",
  exito: "border-verde-500/40 bg-verde-100 text-verde-600",
  aviso: "border-coral-500/40 bg-coral-100 text-coral-600",
  error: "border-error-500/40 bg-error-100 text-error-600",
};

export function Aviso({ tono, titulo, children }: { tono: Tono; titulo?: string; children?: ReactNode }) {
  return (
    <div role={tono === "error" ? "alert" : undefined} className={`rounded-2xl border p-4 ${COLORES_DE_TONO[tono]}`}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
