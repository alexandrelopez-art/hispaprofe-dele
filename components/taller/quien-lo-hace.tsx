"use client";

import { useState } from "react";
import { asignarExamenAccion, quitarAsignacionAccion } from "@/app/(sitio)/examenes/acciones";
import type { EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import { NOMBRE_CORTO } from "@/lib/dele/estructura";
import { fechaEnPalabras } from "@/lib/tiempo/madrid";
import type { Prueba } from "@/lib/generated/prisma";
import { tonoParaElProfesor } from "@/lib/carcasa/tonos";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Casilla } from "@/components/ui/casilla";
import { Enlace } from "@/components/ui/enlace";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { GrupoDeOpciones } from "@/components/ui/grupo-de-opciones";

// Solo lectura y auditiva tienen ficha: la escrita se corrige en /pendientes,
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
          <Boton
            variante="secundario"
            onClick={() => setMarcados(marcados.length === estudiantes.length ? [] : estudiantes.map((e) => e.id))}
            className="self-start"
          >
            {marcados.length === estudiantes.length ? "Desmarcar todos" : "Marcar todos"}
          </Boton>
        )}
        <ul className="flex flex-col gap-1">
          {estudiantes.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3">
              <Casilla
                id={`estudiante-${e.id}`}
                name="estudiante"
                value={e.id}
                etiqueta={e.nombre}
                checked={marcados.includes(e.id)}
                onChange={() =>
                  setMarcados((m) => (m.includes(e.id) ? m.filter((x) => x !== e.id) : [...m, e.id]))
                }
              />
              {fechaDe.has(e.id) && (
                <span className="text-sm text-tinta-suave">ya lo tiene para el {fechaEnPalabras(fechaDe.get(e.id)!)}</span>
              )}
            </li>
          ))}
        </ul>
        <Campo id="dia-tope" name="dia" type="date" etiqueta="Fecha tope" required className="w-auto" />
        {/* El modo de la tanda. Nace en completo: el examen de verdad es lo
            normal, y la práctica libre abre los cuatro ficheros y no deja
            ningún registro. Sin estas dos casillas, «LIBRE» no lo escribía
            nadie en toda la aplicación. */}
        <GrupoDeOpciones
          nombre="modo"
          leyenda="Cómo lo hace"
          valorInicial="COMPLETO"
          opciones={[
            { valor: "COMPLETO", texto: "Completo: con reloj, cada audio una vez, y queda la nota." },
            { valor: "LIBRE", texto: "Práctica libre: sin reloj, audios repetibles, se corrige tarea a tarea y no queda nota." },
          ]}
        />
        <Boton type="submit" className="self-start">Asignar</Boton>
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
                  <Boton type="submit" variante="secundario">Quitárselo</Boton>
                </form>
              </div>
              {/* `pruebas` trae solo las que dejan rastro: las tres en un examen
                  completo, y en práctica libre únicamente la escrita (la
                  lectura y la auditiva se corrigen al vuelo y no guardan nada,
                  así que un estado suyo sería inventado). Puede llegar vacía
                  —una libre sin escrita empezada—, y entonces no se pinta la
                  línea. Hoy nunca llega vacía; la guarda es para que un
                  <QuienLoHace> pintado con una lista vacía no deje un renglón
                  suelto. */}
              {a.pruebas.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave">
                  {a.pruebas.map((p) => (
                    <span key={p.prueba} className="inline-flex items-center gap-1">
                      {NOMBRE_CORTO[p.prueba]}:{" "}
                      {p.estado.estado === "ENTREGADA" && PRUEBAS_CON_FICHA.includes(p.prueba) ? (
                        <Enlace href={`/examenes/${examenId}/hoja/${a.personaId}/${p.prueba}`}>
                          <EtiquetaEstado tono={tonoParaElProfesor(p)}>{p.texto}</EtiquetaEstado>
                        </Enlace>
                      ) : (
                        <EtiquetaEstado tono={tonoParaElProfesor(p)}>{p.texto}</EtiquetaEstado>
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
