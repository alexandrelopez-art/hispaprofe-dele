"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParaCorregir } from "@/lib/examen/corregir";
import { BANDA_MAXIMA, CRITERIOS_EE } from "@/lib/dele/estructura";
import { guardarCorreccionAccion } from "@/app/corregir/acciones";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import { AVISO_DE_ERROR, BOTON, BOTON_SUAVE, CAJA } from "@/components/examen/piezas";

const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" });

/** Las bandas de una tarea, siempre con una casilla por criterio (0 si
 *  todavía no hay nota, que es distinto de que la fila no exista). */
function bandasIniciales(bandas: number[]): number[] {
  return CRITERIOS_EE.map((_, i) => bandas[i] ?? 0);
}

/**
 * La pantalla de corregir UNA redacción: el enunciado de cada tarea (de
 * lectura, con `<EnunciadoDeEscrita bloqueado>`), lo que escribió el
 * estudiante, y las cuatro casillas de banda más el comentario, tarea a
 * tarea. Guardar firma la corrección entera de golpe (las dos tareas juntas),
 * como hace `guardarCorreccion` en el servidor.
 */
export function CorregirEscrita({ para }: { para: ParaCorregir }) {
  const router = useRouter();
  const [bandas, setBandas] = useState<Record<number, number[]>>(() =>
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

  function tareasParaGuardar() {
    return para.tareas.map((t) => ({
      tarea: t.numero,
      bandas: bandas[t.numero] ?? bandasIniciales(t.bandas),
      comentario: comentarios[t.numero] ?? t.comentario,
    }));
  }

  function guardar(irASiguiente: boolean) {
    empezarTransicion(async () => {
      const r = await guardarCorreccionAccion(para.intentoId, tareasParaGuardar());
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

  function cambiarBanda(tarea: number, indice: number, valor: number) {
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
          Entregada el {FECHA_LARGA.format(para.entregadaEn)}
          {para.porTiempo ? " · por tiempo" : ""}
        </p>
        {/* Firmar es un acto con fecha: si ya la corrigió, la pantalla lo dice
            y avisa de que volver a guardar cambia la corrección ya firmada. */}
        {para.corregidaEn !== null && (
          <p role="alert" className={AVISO_DE_ERROR}>
            Ya la corregiste el {FECHA_LARGA.format(para.corregidaEn)}; si guardas, se cambia.
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
                {criterio.ayuda !== "" && <span className="text-sm text-tinta-suave">{criterio.ayuda}</span>}
                <input
                  type="number"
                  min={0}
                  max={BANDA_MAXIMA}
                  step={1}
                  value={bandas[t.numero]?.[i] ?? 0}
                  disabled={procesando}
                  onChange={(e) => cambiarBanda(t.numero, i, Number(e.target.value))}
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

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={procesando} onClick={() => guardar(false)} className={BOTON}>
          Guardar
        </button>
        <button type="button" disabled={procesando} onClick={() => guardar(true)} className={BOTON_SUAVE}>
          Guardar y seguir
        </button>
      </div>
    </main>
  );
}
