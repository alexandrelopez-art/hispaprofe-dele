import type { ReactNode } from "react";

export function BloqueVacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-tinta-suave/30 bg-white/60 p-8 text-center">
      <p className="text-lg font-bold">{titulo}</p>
      {texto && <p className="text-tinta-suave">{texto}</p>}
      {accion}
    </div>
  );
}
