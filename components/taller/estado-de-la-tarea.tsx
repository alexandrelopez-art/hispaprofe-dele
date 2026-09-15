import type { EstadoDeTarea } from "@/lib/taller/estado";

export const NOMBRE_DEL_ESTADO: Record<EstadoDeTarea["estado"], string> = {
  VACIA: "Vacía",
  A_MEDIAS: "A medias",
  COMPLETA: "Completa",
};

const COLOR: Record<EstadoDeTarea["estado"], string> = {
  VACIA: "bg-tinta-suave/10 text-tinta-suave",
  A_MEDIAS: "bg-sol-100 text-tinta",
  COMPLETA: "bg-verde-100 text-verde-600",
};

export function InsigniaDeEstado({ estado }: { estado: EstadoDeTarea["estado"] }) {
  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${COLOR[estado]}`}>{NOMBRE_DEL_ESTADO[estado]}</span>;
}

export function EstadoDeLaTarea({ estado }: { estado: EstadoDeTarea }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-tinta-suave/20 bg-white p-4" aria-live="polite">
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
    </section>
  );
}
