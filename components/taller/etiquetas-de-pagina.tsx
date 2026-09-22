"use client";

import { useState, useTransition } from "react";
import { etiquetarPaginaAccion } from "@/app/(sitio)/examenes/acciones";
import { Aviso } from "@/components/ui/aviso";
import { nombreDeEtiqueta } from "@/lib/dele/estructura";
import { alternarEtiqueta } from "@/lib/taller/etiquetas";

type Pagina = { id: string; ficheroId: string; orden: number; etiquetas: string[] };

export function EtiquetasDePagina({ examenId, pagina, todas }: { examenId: string; pagina: Pagina; todas: string[] }) {
  const [marcadas, setMarcadas] = useState(pagina.etiquetas);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function pulsar(etiqueta: string) {
    const antes = marcadas;
    const nuevas = alternarEtiqueta(todas, marcadas, etiqueta);
    setMarcadas(nuevas);
    setError(null);
    empezar(async () => {
      const r = await etiquetarPaginaAccion(examenId, pagina.id, nuevas);
      if (r.error) {
        setMarcadas(antes);
        setError(r.error);
      }
    });
  }

  return (
    <figure className={`flex min-w-0 flex-col gap-2 rounded-2xl border bg-white p-3 ${marcadas.length === 0 ? "border-sol-400" : "border-tinta-suave/20"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos; next/image lo cachearía */}
      <img src={`/api/ficheros/${pagina.ficheroId}`} alt={`Hoja ${pagina.orden}`} loading="lazy" className="w-full rounded-xl border border-tinta-suave/10" />
      <figcaption className="flex flex-col gap-2">
        <span className="font-bold">Hoja {pagina.orden}{marcadas.length === 0 ? " · sin etiquetar" : ""}</span>
        <div className="flex flex-wrap gap-1">
          {todas.map((etiqueta) => {
            const puesta = marcadas.includes(etiqueta);
            return (
              <button
                key={etiqueta}
                type="button"
                aria-pressed={puesta}
                disabled={pendiente}
                onClick={() => pulsar(etiqueta)}
                className={`rounded-full px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 ${puesta ? "bg-hp-700 font-bold text-white" : "border border-tinta-suave/30"}`}
              >
                {nombreDeEtiqueta(etiqueta)}
              </button>
            );
          })}
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}
      </figcaption>
    </figure>
  );
}
