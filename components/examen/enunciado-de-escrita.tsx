"use client";

import type { Formulario } from "@/lib/taller/formas";

const PAUTAS = "list-disc pl-6";

/**
 * El enunciado de una tarea de escrita, como lo ve el estudiante. Es de
 * LECTURA: no edita nada (eso es el taller). Lo único que se toca aquí es
 * elegir opción en la tarea 2, y solo si llega `alElegir`.
 */
export function EnunciadoDeEscrita({
  formulario, opcionElegida, alElegir, bloqueado = false,
}: {
  formulario: Formulario;
  opcionElegida: number | null;
  alElegir?: (opcion: number) => void;
  bloqueado?: boolean;
}) {
  if (formulario.forma === "REDACCION_UNA") {
    const a = formulario.actividad;
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <p>{formulario.consigna}</p>
        {a.situacion && <p>{a.situacion}</p>}
        {a.textoRecibido && (
          <blockquote className="rounded-2xl border border-tinta-suave/20 bg-tinta-suave/5 p-4 whitespace-pre-line">
            {a.textoRecibido}
          </blockquote>
        )}
        <ul className={PAUTAS}>
          {a.pautas.filter((p) => p.trim() !== "").map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </section>
    );
  }
  if (formulario.forma === "REDACCION_DOS") {
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <p>{formulario.consigna}</p>
        {formulario.actividad.opciones.map((o, i) => {
          const numero = i + 1;
          return (
            <label key={numero} className="flex gap-3 rounded-2xl border border-tinta-suave/20 p-4">
              <input
                type="radio"
                name="opcion-de-la-escrita"
                checked={opcionElegida === numero}
                disabled={bloqueado || !alElegir}
                onChange={() => alElegir?.(numero)}
                className="mt-1"
              />
              <span className="flex flex-col gap-2">
                <span className="font-bold">{o.titulo || `Opción ${numero}`}</span>
                {o.contexto && <span className="whitespace-pre-line">{o.contexto}</span>}
                <ul className={PAUTAS}>
                  {o.pautas.filter((p) => p.trim() !== "").map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </span>
            </label>
          );
        })}
      </section>
    );
  }
  // Ninguna otra forma llega aquí: la escrita solo tiene estas dos. Si algún
  // día llega otra, mejor no pintar nada que pintar algo a medias.
  return null;
}
