import type { ReactNode } from "react";
import { COLORES_DE_TONO, type Tono } from "@/components/ui/aviso";

const NEUTRO = "border-tinta-suave/20 bg-fondo text-tinta-suave";

export function EtiquetaEstado({ tono, children }: { tono: Tono | "neutro"; children: ReactNode }) {
  const colores = tono === "neutro" ? NEUTRO : COLORES_DE_TONO[tono];
  return <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-bold ${colores}`}>{children}</span>;
}
