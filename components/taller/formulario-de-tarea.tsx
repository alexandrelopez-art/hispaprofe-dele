"use client";

import { useState, useTransition } from "react";
import { guardarTareaAccion } from "@/app/examenes/acciones";
import type { ReglaTarea } from "@/lib/dele/estructura";
import { cambiar as cambiarEn, type Ruta } from "@/lib/taller/editar";
import type { EstadoDeTarea } from "@/lib/taller/estado";
import type { Formulario } from "@/lib/taller/formas";
import { CAJA, Campo } from "./campo";
import { EstadoDeLaTarea } from "./estado-de-la-tarea";
import { FormaHuecos, FormaListaComun, FormaOpciones, FormaRelacionar } from "./formas-cerradas";
import { FormaOralDirecto, FormaOralSolo, FormaRedaccionDos, FormaRedaccionUna } from "./formas-abiertas";

type Props = {
  examenId: string;
  prueba: string;
  numero: number;
  regla: ReglaTarea;
  inicial: Formulario;
  respuestas: Record<string, string> | null;
  temasDeLaHermana: string[] | null;
  estadoInicial: EstadoDeTarea;
};

export function FormularioDeTarea({ examenId, prueba, numero, regla, inicial, respuestas, temasDeLaHermana, estadoInicial }: Props) {
  const [f, setF] = useState<Formulario>(inicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [error, setError] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardando, empezar] = useTransition();

  const cambiar = (ruta: Ruta, valor: unknown) => {
    setF((actual) => cambiarEn(actual, ruta, valor));
    setSinGuardar(true);
  };

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await guardarTareaAccion(examenId, prueba, numero, f);
      if ("error" in r) setError(r.error);
      else {
        setEstado(r.estado);
        setSinGuardar(false);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EstadoDeLaTarea estado={estado} />
      <section className={CAJA}>
        <Campo etiqueta="Consigna, ya corregida (sin «Hoja de respuestas»)" valor={f.consigna} alCambiar={(v) => cambiar(["consigna"], v)} largo />
      </section>
      {f.textos.map((t, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Texto {i + 1}</h3>
          <Campo etiqueta="Nombre o título" valor={t.etiqueta} alCambiar={(v) => cambiar(["textos", i, "etiqueta"], v)} opcional />
          <Campo etiqueta="Texto" valor={t.texto} alCambiar={(v) => cambiar(["textos", i, "texto"], v)} largo />
        </section>
      ))}

      {f.forma === "RELACIONAR" && <FormaRelacionar f={f} regla={regla} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "LISTA_COMUN" && <FormaListaComun f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "OPCIONES" && <FormaOpciones f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "HUECOS" && <FormaHuecos f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "REDACCION_UNA" && <FormaRedaccionUna f={f} cambiar={cambiar} />}
      {f.forma === "REDACCION_DOS" && <FormaRedaccionDos f={f} cambiar={cambiar} />}
      {f.forma === "ORAL_SOLO" && <FormaOralSolo f={f} cambiar={cambiar} />}
      {f.forma === "ORAL_DIRECTO" && <FormaOralDirecto f={f} cambiar={cambiar} temasDeLaHermana={temasDeLaHermana} />}

      {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-tinta-suave/20 bg-fondo py-3">
        <button type="button" onClick={guardar} disabled={guardando} className="rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {sinGuardar && <span className="text-tinta-suave">Hay cambios sin guardar.</span>}
      </div>
    </div>
  );
}
