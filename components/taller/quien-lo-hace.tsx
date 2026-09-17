"use client";

import { useState } from "react";
import Link from "next/link";
import { asignarExamenAccion, quitarAsignacionAccion } from "@/app/examenes/acciones";
import type { EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import { NOMBRE_CORTO } from "@/lib/dele/estructura";
import { fechaEnPalabras } from "@/lib/tiempo/madrid";
import type { Prueba } from "@/lib/generated/prisma";

// Solo lectura y auditiva tienen ficha: la escrita se corrige en /corregir,
// que es otra pantalla, y una escrita ESPERANDO (entregada sin firmar) no
// tiene nada congelado que enseñar todavía. Tipada como Prueba[] (no
// inferida como string[]) para que una errata aquí ("CO" mal escrito, o un
// valor que no es una prueba de verdad) la cace el compilador, no una prueba.
const PRUEBAS_CON_FICHA: Prueba[] = ["CE", "CO"];

type Estudiante = { id: string; nombre: string };
type Asignada = { personaId: string; nombre: string; fechaTope: Date; pruebas: EstadoDeUnaPrueba[] };

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
        {/* El modo de la tanda. Nace en completo: el examen de verdad es lo
            normal, y la práctica libre abre los cuatro ficheros y no deja
            ningún registro. Sin estas dos casillas, «LIBRE» no lo escribía
            nadie en toda la aplicación. */}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-bold text-tinta-suave">Cómo lo hace</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" value="COMPLETO" defaultChecked />
            <span>Completo: con reloj, cada audio una vez, y queda la nota.</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" value="LIBRE" />
            <span>Práctica libre: sin reloj, audios repetibles, se corrige tarea a tarea y no queda nota.</span>
          </label>
        </fieldset>
        <button type="submit" className="self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white">Asignar</button>
      </form>

      {asignaciones.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-tinta-suave/20 pt-3">
          {asignaciones.map((a) => (
            <li key={a.personaId} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <span>{a.nombre} — {fechaEnPalabras(a.fechaTope)}</span>
                {/* Un botón que cambia algo es siempre un formulario POST, nunca un
                    enlace: Next precarga los enlaces de la pantalla en cuanto se
                    pintan, y eso los dispara solos. */}
                <form action={quitarAsignacionAccion.bind(null, examenId, a.personaId)}>
                  <button type="submit" className="text-hp-600 underline">Quitárselo</button>
                </form>
              </div>
              {/* En modo libre no hay intento nunca, y `pruebas` llega vacío: no se
                  pinta ningún estado, porque uno inventado sería mentira. */}
              {a.pruebas.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave">
                  {a.pruebas.map((p) => (
                    <span key={p.prueba}>
                      {NOMBRE_CORTO[p.prueba]}:{" "}
                      {p.estado.estado === "ENTREGADA" && PRUEBAS_CON_FICHA.includes(p.prueba) ? (
                        <Link href={`/examenes/${examenId}/hoja/${a.personaId}/${p.prueba}`} className="text-hp-600 underline">
                          {p.texto}
                        </Link>
                      ) : (
                        p.texto
                      )}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
