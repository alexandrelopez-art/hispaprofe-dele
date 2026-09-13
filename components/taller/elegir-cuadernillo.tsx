"use client";

import { useState } from "react";
import { elegirCuadernilloAccion } from "@/app/examenes/acciones";
import { examenesDelCuadernillo } from "@/lib/taller/cuadernillo-elegido";

type Cuadernillo = { id: string; titulo: string; examenes: string[] };

export function ElegirCuadernillo({
  examenId,
  cuadernillos,
  elegidoId,
  numero,
}: {
  examenId: string;
  cuadernillos: Cuadernillo[];
  elegidoId: string | null;
  numero: number | null;
}) {
  const [cuadernilloId, setCuadernilloId] = useState(elegidoId ?? "");
  const [numeroElegido, setNumeroElegido] = useState(numero === null ? "" : String(numero));
  const examenes = examenesDelCuadernillo(cuadernillos, cuadernilloId);

  return (
    <form action={elegirCuadernilloAccion.bind(null, examenId)} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-tinta-suave">Cuadernillo</span>
        <select
          name="cuadernilloId"
          value={cuadernilloId}
          onChange={(e) => {
            // Cambiar de libro no puede dejar puesto un número que era de
            // otro: si el nuevo también tiene ese número, se aceptaría en
            // silencio y quedaría emparejado con las respuestas equivocadas.
            setCuadernilloId(e.target.value);
            setNumeroElegido("");
          }}
          className="rounded-xl border border-tinta-suave/30 bg-white p-3"
        >
          <option value="">Ninguno</option>
          {cuadernillos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-tinta-suave">Qué examen del libro es</span>
        <select
          name="numero"
          value={numeroElegido}
          onChange={(e) => setNumeroElegido(e.target.value)}
          className="rounded-xl border border-tinta-suave/30 bg-white p-3"
        >
          <option value="">Sin elegir</option>
          {examenes.map((e) => <option key={e} value={e}>Examen {e}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-xl bg-hp-400 px-4 py-3 font-bold text-white">Guardar</button>
    </form>
  );
}
