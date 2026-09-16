"use client";

import { useState } from "react";
import { asignarExamenAccion, quitarAsignacionAccion } from "@/app/examenes/acciones";
import { fechaEnPalabras } from "@/lib/tiempo/madrid";

type Estudiante = { id: string; nombre: string };
type Asignada = { personaId: string; nombre: string; fechaTope: Date };

export function QuienLoHace({
  examenId,
  estudiantes,
  asignaciones,
}: {
  examenId: string;
  estudiantes: Estudiante[];
  asignaciones: Asignada[];
}) {
  // Nacen vacías a propósito, también las de quien ya lo tiene: si nacieran
  // marcadas, asignárselo a uno nuevo le cambiaría la fecha a los demás.
  const [marcados, setMarcados] = useState<string[]>([]);
  const fechaDe = new Map(asignaciones.map((a) => [a.personaId, a.fechaTope]));

  return (
    <div className="flex flex-col gap-4">
      <form action={asignarExamenAccion.bind(null, examenId)} className="flex flex-col gap-3">
        {estudiantes.length > 0 && (
          <button
            type="button"
            onClick={() => setMarcados(marcados.length === estudiantes.length ? [] : estudiantes.map((e) => e.id))}
            className="self-start text-hp-600 underline"
          >
            {marcados.length === estudiantes.length ? "Desmarcar todos" : "Marcar todos"}
          </button>
        )}
        <ul className="flex flex-col gap-1">
          {estudiantes.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="estudiante"
                  value={e.id}
                  checked={marcados.includes(e.id)}
                  onChange={() =>
                    setMarcados((m) => (m.includes(e.id) ? m.filter((x) => x !== e.id) : [...m, e.id]))
                  }
                />
                <span>{e.nombre}</span>
                {fechaDe.has(e.id) && (
                  <span className="text-sm text-tinta-suave">ya lo tiene para el {fechaEnPalabras(fechaDe.get(e.id)!)}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2">
          <span className="text-sm font-bold text-tinta-suave">Fecha tope</span>
          <input type="date" name="dia" required className="rounded-xl border border-tinta-suave/30 p-2" />
        </label>
        <button type="submit" className="self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white">Asignar</button>
      </form>

      {asignaciones.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-tinta-suave/20 pt-3">
          {asignaciones.map((a) => (
            <li key={a.personaId} className="flex flex-wrap items-center gap-3">
              <span>{a.nombre} — {fechaEnPalabras(a.fechaTope)}</span>
              {/* Un botón que cambia algo es siempre un formulario POST, nunca un
                  enlace: Next precarga los enlaces de la pantalla en cuanto se
                  pintan, y eso los dispara solos. */}
              <form action={quitarAsignacionAccion.bind(null, examenId, a.personaId)}>
                <button type="submit" className="text-hp-600 underline">Quitárselo</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
