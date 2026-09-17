"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParaCorregir, TareaParaCorregir } from "@/lib/examen/corregir";
import { BANDA_MAXIMA, CRITERIOS_EE } from "@/lib/dele/estructura";
import { guardarCorreccionAccion } from "@/app/corregir/acciones";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import { enLista } from "@/components/examen/hacer-escrita";
import { AVISO_DE_ERROR, AVISO_SUAVE, BOTON, BOTON_SUAVE, CAJA } from "@/components/examen/piezas";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";

/** Una banda por criterio. `null` = todavía sin nota: es distinto de un 0, que
 *  es una nota válida. Confundir los dos es justo el agujero que esta forma
 *  existe para tapar. */
type Bandas = (number | null)[];

/** Nace vacía si nunca se corrigió (`bandas.length === 0`); si ya tiene las
 *  cuatro, son las de verdad, no ceros de relleno. */
function bandasIniciales(bandas: number[]): Bandas {
  return bandas.length === CRITERIOS_EE.length ? bandas : CRITERIOS_EE.map(() => null);
}

/** Los números de tarea a los que les falta alguna banda. */
function tareasIncompletas(bandas: Record<number, Bandas>, tareas: TareaParaCorregir[]): number[] {
  return tareas.filter((t) => (bandas[t.numero] ?? []).some((b) => b === null)).map((t) => t.numero);
}

/** «Te faltan notas en la tarea 2.» / «Te faltan notas en las tareas 1 y 2.» */
function mensajeDeFaltantes(faltan: number[]): string {
  const tareas = faltan.length === 1 ? "la tarea" : "las tareas";
  return `Te faltan notas en ${tareas} ${enLista(faltan.map(String))}.`;
}

/**
 * Los dos botones de guardar, aparte de la pantalla para poder pintarlos
 * solos con `procesando` fijo: dentro de `CorregirEscrita` solo se apagan
 * tras un clic, y aquí no hay jsdom para simular uno.
 */
export function BotonesDeGuardar({
  procesando, alGuardar, alGuardarYSeguir,
}: {
  procesando: boolean;
  alGuardar: () => void;
  alGuardarYSeguir: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={procesando} onClick={alGuardar} className={BOTON}>
        Guardar
      </button>
      <button type="button" disabled={procesando} onClick={alGuardarYSeguir} className={BOTON_SUAVE}>
        Guardar y seguir
      </button>
    </div>
  );
}

/**
 * La pantalla de corregir UNA redacción: el enunciado de cada tarea (de
 * lectura, con `<EnunciadoDeEscrita bloqueado>`), lo que escribió el
 * estudiante, y las cuatro casillas de banda más el comentario, tarea a
 * tarea. Guardar firma la corrección entera de golpe (las dos tareas juntas),
 * como hace `guardarCorreccion` en el servidor.
 *
 * Las ocho casillas NACEN VACÍAS cuando no hay corrección previa, no a cero:
 * `guardarCorreccion` firma con la fecha en cualquier guardado, así que un
 * profesor que solo rellenara la tarea 1 y guardara firmaría la tarea 2 con
 * cuatro ceros sin querer, y esa redacción saldría de la cola con una nota
 * que nadie puso. «Guardar» y «Guardar y seguir» se niegan mientras falte
 * alguna casilla; un 0 escrito a mano sigue siendo una nota válida.
 */
export function CorregirEscrita({ para }: { para: ParaCorregir }) {
  const router = useRouter();
  const [bandas, setBandas] = useState<Record<number, Bandas>>(() =>
    Object.fromEntries(para.tareas.map((t) => [t.numero, bandasIniciales(t.bandas)])),
  );
  const [comentarios, setComentarios] = useState<Record<number, string>>(() =>
    Object.fromEntries(para.tareas.map((t) => [t.numero, t.comentario])),
  );
  const [error, setError] = useState<string | null>(null);
  // Apaga los dos botones desde el primer clic hasta que vuelve el servidor:
  // sin esto, un doble clic (o la misma redacción abierta en dos pestañas)
  // manda dos firmas a la vez y la segunda pisa a la primera.
  const [procesando, empezarTransicion] = useTransition();

  function guardar(irASiguiente: boolean) {
    const incompletas = tareasIncompletas(bandas, para.tareas);
    if (incompletas.length > 0) {
      setError(mensajeDeFaltantes(incompletas));
      return;
    }
    const tareas = para.tareas.map((t) => ({
      tarea: t.numero,
      bandas: (bandas[t.numero] ?? []).map((b) => b as number),
      comentario: comentarios[t.numero] ?? t.comentario,
    }));
    empezarTransicion(async () => {
      const r = await guardarCorreccionAccion(para.intentoId, tareas);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (irASiguiente) {
        router.push(para.siguiente ? `/corregir/${para.siguiente}` : "/corregir");
      } else {
        router.refresh();
      }
    });
  }

  function cambiarBanda(tarea: number, indice: number, valor: number | null) {
    setBandas((actual) => {
      const fila = [...(actual[tarea] ?? bandasIniciales([]))];
      fila[indice] = valor;
      return { ...actual, [tarea]: fila };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 p-6">
      <header className={CAJA}>
        <h1 className="text-2xl font-bold">{para.persona.nombre}</h1>
        <p className="text-tinta-suave">{para.examen.titulo}</p>
        <p className="text-sm text-tinta-suave">
          Entregada el {fechaHoraEnPalabras(para.entregadaEn)}
          {para.porTiempo ? " · por tiempo" : ""}
        </p>
        {/* Firmar es un acto con fecha: si ya la corrigió, la pantalla lo dice
            y avisa de que volver a guardar cambia la corrección ya firmada.
            No es un error —nada se ha roto—, así que lleva el aviso suave. */}
        {para.corregidaEn !== null && (
          <p role="status" className={AVISO_SUAVE}>
            Ya la corregiste el {fechaHoraEnPalabras(para.corregidaEn)}; si guardas, se cambia.
          </p>
        )}
      </header>

      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}

      {para.tareas.map((t) => (
        <section key={t.numero} className={CAJA}>
          <h2 className="text-xl font-bold">Tarea {t.numero}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <EnunciadoDeEscrita formulario={t.formulario} opcionElegida={t.opcion} bloqueado />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="min-w-0 rounded-2xl border border-tinta-suave/20 bg-tinta-suave/5 p-4 whitespace-pre-line">
                {t.texto}
              </p>
              <p className="text-sm text-tinta-suave">{t.palabras} palabras</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {CRITERIOS_EE.map((criterio, i) => (
              <label key={criterio.clave} className="flex flex-col gap-1">
                <span className="font-bold">{criterio.nombre}</span>
                {criterio.ayuda !== "" && <span data-ayuda className="text-sm text-tinta-suave">{criterio.ayuda}</span>}
                <input
                  type="number"
                  min={0}
                  max={BANDA_MAXIMA}
                  step={1}
                  value={bandas[t.numero]?.[i] ?? ""}
                  disabled={procesando}
                  onChange={(e) => cambiarBanda(t.numero, i, e.target.value === "" ? null : Number(e.target.value))}
                  className="w-24 rounded-xl border border-tinta-suave/30 p-2 disabled:opacity-50"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="font-bold">Comentario</span>
              <textarea
                value={comentarios[t.numero] ?? ""}
                disabled={procesando}
                onChange={(e) => setComentarios((actual) => ({ ...actual, [t.numero]: e.target.value }))}
                className="rounded-2xl border border-tinta-suave/30 p-3 disabled:opacity-50"
                rows={4}
              />
            </label>
          </div>
        </section>
      ))}

      <BotonesDeGuardar procesando={procesando} alGuardar={() => guardar(false)} alGuardarYSeguir={() => guardar(true)} />
    </main>
  );
}
