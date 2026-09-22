import type { EstadoDeTarea } from "@/lib/taller/estado";
import { tonoDeTarea } from "@/lib/carcasa/tonos";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Tarjeta } from "@/components/ui/tarjeta";

export const NOMBRE_DEL_ESTADO: Record<EstadoDeTarea["estado"], string> = {
  VACIA: "Vacía",
  A_MEDIAS: "A medias",
  COMPLETA: "Completa",
};

export function InsigniaDeEstado({ estado }: { estado: EstadoDeTarea["estado"] }) {
  return <EtiquetaEstado tono={tonoDeTarea(estado)}>{NOMBRE_DEL_ESTADO[estado]}</EtiquetaEstado>;
}

export function EstadoDeLaTarea({ estado }: { estado: EstadoDeTarea }) {
  return (
    <Tarjeta as="section" className="flex flex-col gap-2">
      {/* La Tarjeta no pasa atributos: el aria-live va en este div, que
          envuelve la etiqueta y los motivos. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaDeEstado estado={estado.estado} />
        </div>
        {estado.estado !== "COMPLETA" && estado.motivos.length > 0 && (
          <ul className="list-disc pl-5 text-tinta">
            {estado.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    </Tarjeta>
  );
}
