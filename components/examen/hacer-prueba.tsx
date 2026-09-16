"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Prueba } from "@/lib/generated/prisma";
import type { PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { NOMBRE_DE_PRUEBA } from "@/lib/dele/estructura";
import { textoDelEstado } from "@/lib/examen/motor";
import { itemsDelFormulario } from "@/lib/taller/estado";
import {
  corregirEnLibreAccion,
  empezarPruebaAccion,
  entregarPruebaAccion,
  guardarRespuestaAccion,
} from "@/app/examen/acciones";
import { Reloj } from "@/components/examen/reloj";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";

type Marcadas = Record<string, string>;
type NotaDeTarea = { aciertos: number; total: number; fallos: number[] };

const CAJA = "flex min-w-0 flex-col gap-4 rounded-2xl border border-tinta-suave/20 bg-white p-5";
const BOTON = "self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50";
const AVISO_DE_ERROR = "rounded-2xl bg-error-100 p-4 text-error-600";

function totalDePreguntas(tareas: TareaParaHacer[]): number {
  return tareas.reduce((n, t) => n + (t.regla.items ?? 0), 0);
}

/** Cuántas de las marcadas tienen de verdad una letra (una cadena vacía guardada no cuenta como contestada). */
function contarContestadas(marcadas: Marcadas): number {
  return Object.values(marcadas).filter((letra) => letra.trim() !== "").length;
}

/**
 * La corrección de una tarea, en modo libre. `corregirEnLibreAccion` corrige
 * la PRUEBA entera (lib/examen/hacer.ts no admite corregir una tarea sola: la
 * clave sale de `claveDeLaPrueba`, que junta las cuatro), así que sus fallos
 * cubren las 25 preguntas de golpe. Aquí se recorta el resultado a la tarea
 * que lo pidió: sus propios números (de `itemsDelFormulario`, la misma
 * fuente que usa `letrasPosibles`), su propio total, su propia nota.
 *
 * Aislada de React (no toca useState) y con la acción como argumento para
 * poder doblarla y probarla sin renderizar nada.
 */
export async function corregirTareaEnLibre(
  examenId: string,
  prueba: Prueba,
  marcadas: Marcadas,
  tarea: TareaParaHacer,
  accion: typeof corregirEnLibreAccion,
): Promise<NotaDeTarea | { error: string }> {
  const r = await accion(examenId, prueba, marcadas);
  if ("error" in r) return r;
  const numerosDeLaTarea = new Set(itemsDelFormulario(tarea.formulario));
  const fallos = r.fallos.filter((f) => numerosDeLaTarea.has(f.numero)).map((f) => f.numero);
  return { aciertos: numerosDeLaTarea.size - fallos.length, total: numerosDeLaTarea.size, fallos };
}

/**
 * El aviso previo: se dice ANTES de entrar, no después — es lo que hace
 * honesto el «no se puede repetir» (lectura) o el «una sola vez» (auditiva).
 * Pulsar «Empezar» fija el reloj del servidor y es también el gesto del
 * usuario que, más adelante (Tarea 9), deja al navegador reproducir el
 * primer audio sin que nadie tenga que tocar nada más.
 */
function AvisoPrevio({
  prueba, alEmpezar, enviando, error,
}: {
  prueba: PruebaParaHacer;
  alEmpezar: () => void;
  enviando: boolean;
  error: string | null;
}) {
  // Lo que decide el aviso es QUÉ prueba es, no si lleva reloj: son la misma
  // cosa hoy (solo CE lo lleva), pero decirlo por minutos mezclaría, el día
  // que cambie una regla de tiempos, la pregunta «¿es lectura?» con la
  // pregunta «¿tiene reloj?».
  const esLectura = prueba.prueba === "CE";
  return (
    <section className={CAJA}>
      <h1 className="text-xl font-bold">
        {prueba.examen.titulo} · {NOMBRE_DE_PRUEBA[prueba.prueba]}
      </h1>
      {esLectura ? (
        <p>Tienes {prueba.minutos} minutos. Cuando se acaben, la prueba se entrega ella sola: no se puede repetir.</p>
      ) : (
        <p>Cada audio suena una sola vez. Si se corta la red, ese trozo se pierde para siempre: no vuelve a sonar.</p>
      )}
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <button type="button" disabled={enviando} onClick={alEmpezar} className={BOTON}>
        Empezar
      </button>
    </section>
  );
}

/** Las pestañas de las cuatro tareas. Cambiar de pestaña es solo estado local: no va al servidor. */
function PestanasDeTarea({
  tareas, abierta, alElegir,
}: {
  tareas: TareaParaHacer[];
  abierta: number;
  alElegir: (numero: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tareas.map((t) => (
        <button
          key={t.numero}
          type="button"
          aria-current={t.numero === abierta ? "true" : undefined}
          onClick={() => alElegir(t.numero)}
          className={`rounded-full px-4 py-2 font-bold ${t.numero === abierta ? "bg-hp-400 text-white" : "border border-tinta-suave/30"}`}
        >
          Tarea {t.numero}
        </button>
      ))}
    </div>
  );
}

/** A medias: el reloj (si la prueba lo lleva), las cuatro tareas libres entre sí, y «Entregar». */
function PruebaHaciendo({ prueba }: { prueba: PruebaParaHacer }) {
  const router = useRouter();
  const examenId = prueba.examen.id;
  const [marcadas, setMarcadas] = useState<Marcadas>(prueba.respuestas);
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [bloqueadaPorError, setBloqueadaPorError] = useState(false);
  const [procesando, empezarTransicion] = useTransition();
  // Una sola entrega automática: sin esto, cada re-render (uno por cada
  // guardarRespuestaAccion en curso) le pasa a <Reloj> una alAcabarse con
  // identidad nueva, su efecto se re-dispara con quedan ya en 0, y se
  // llamaría a entregarPruebaAccion una y otra vez.
  const entregadaPorTiempo = useRef(false);

  function alMarcar(numero: number, letra: string) {
    // Se pinta en el acto; la llamada al servidor va detrás, y solo si falla
    // deja de aceptar respuestas (bloqueadaPorError). «Entregar» se deja
    // encendido a propósito (ver alEntregar): lo guardado hasta el fallo no
    // se pierde, y la auditiva no tiene reloj que la rescate sola.
    setMarcadas((m) => ({ ...m, [String(numero)]: letra }));
    empezarTransicion(async () => {
      const r = await guardarRespuestaAccion(examenId, prueba.prueba, numero, letra);
      if (r.error) {
        setError(r.error);
        setBloqueadaPorError(true);
      }
    });
  }

  // Identidad estable entre renders (useCallback): si cambiara en cada
  // render, el useEffect de <Reloj> (que la lleva en sus dependencias) se
  // volvería a disparar en cada marcado aunque `quedan` no se haya movido,
  // y el segundero visible se quedaría reiniciando su propio setTimeout.
  const alAcabarse = useCallback(() => {
    if (entregadaPorTiempo.current) return;
    entregadaPorTiempo.current = true;
    // El reloj avisó por su cuenta: se entrega con porTiempo y se refresca
    // (esto no pasa por un formulario, así que Next no lo revalida solo).
    empezarTransicion(async () => {
      const r = await entregarPruebaAccion(examenId, prueba.prueba, true);
      if (r.error) {
        // «Se entrega sola» solo es honesto si, cuando falla, alguien se
        // entera: sin esto el estudiante se queda mirando 0:00 sin nota y
        // sin aviso. «Entregar» sigue ahí para reintentar a mano.
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }, [examenId, prueba.prueba, empezarTransicion, router]);

  function alEntregar() {
    const total = totalDePreguntas(prueba.tareas);
    const sinMarcar = total - contarContestadas(marcadas);
    const pregunta = sinMarcar > 0
      ? `Te quedan ${sinMarcar} sin contestar. Entregar no se puede deshacer. ¿Entregar de todos modos?`
      : "Entregar no se puede deshacer. ¿Entregar?";
    if (!window.confirm(pregunta)) return;
    empezarTransicion(async () => {
      const r = await entregarPruebaAccion(examenId, prueba.prueba, false);
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];

  return (
    <div className="flex flex-col gap-4">
      {prueba.minutos !== null && prueba.segundosQueQuedan !== null && (
        <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} />
      )}
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <TareaDelEstudiante tarea={tarea} marcadas={marcadas} fallos={null} bloqueada={bloqueadaPorError} alMarcar={alMarcar} />
      )}
      {/* Sin bloqueadaPorError aquí a propósito: un fallo al guardar UNA
          respuesta bloquea las respuestas, no la salida. Sin esto, la
          auditiva (sin reloj que la cierre sola) se quedaría «HACIENDO»
          para siempre. */}
      <button type="button" disabled={procesando} onClick={alEntregar} className={BOTON}>
        Entregar
      </button>
    </div>
  );
}

/** Entregada: se ve, no se toca. La nota arriba, y los fallos marcados en cada tarea. */
function PruebaEntregada({ prueba }: { prueba: PruebaParaHacer }) {
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-bold">{textoDelEstado(prueba.estado)}</p>
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <TareaDelEstudiante tarea={tarea} marcadas={prueba.respuestas} fallos={prueba.fallos} bloqueada alMarcar={() => {}} />
      )}
    </div>
  );
}

/**
 * Modo libre: sin reloj y sin «Entregar» — no hay intento que cerrar, así que
 * ni el uno ni el otro tienen sentido. En su lugar, «Corregir» por tarea: el
 * botón vive bajo la tarea abierta y solo cuenta y pinta SUS preguntas — no
 * las 25 de la prueba entera — aunque por debajo tenga que corregir la
 * prueba entera (corregirTareaEnLibre recorta el resultado). Se puede
 * repetir tantas veces como se quiera, y la nota de una tarea ya corregida
 * se conserva al cambiar de pestaña, hasta que se vuelve a tocar esa tarea.
 */
function PruebaLibre({ prueba }: { prueba: PruebaParaHacer }) {
  const examenId = prueba.examen.id;
  const [marcadas, setMarcadas] = useState<Marcadas>(prueba.respuestas);
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const [notasPorTarea, setNotasPorTarea] = useState<Record<number, NotaDeTarea>>({});
  const [error, setError] = useState<string | null>(null);
  const [procesando, empezarTransicion] = useTransition();

  function alMarcar(numero: number, letra: string) {
    setMarcadas((m) => ({ ...m, [String(numero)]: letra }));
    // Solo la nota de la tarea abierta (la que se acaba de tocar) queda
    // obsoleta; las demás no se han tocado y su nota sigue siendo la de verdad.
    setNotasPorTarea((n) => {
      if (!(tareaAbierta in n)) return n;
      const resto = { ...n };
      delete resto[tareaAbierta];
      return resto;
    });
  }

  function alCorregir(tarea: TareaParaHacer) {
    empezarTransicion(async () => {
      const r = await corregirTareaEnLibre(examenId, prueba.prueba, marcadas, tarea, corregirEnLibreAccion);
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setNotasPorTarea((n) => ({ ...n, [tarea.numero]: r }));
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  const notaDeLaTarea = tarea ? notasPorTarea[tarea.numero] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">Práctica libre: puedes corregir cada tarea tantas veces como quieras.</p>
      {notaDeLaTarea && <p className="text-xl font-bold">{notaDeLaTarea.aciertos} de {notaDeLaTarea.total}</p>}
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <>
          <TareaDelEstudiante
            tarea={tarea}
            marcadas={marcadas}
            fallos={notaDeLaTarea?.fallos ?? null}
            bloqueada={false}
            alMarcar={alMarcar}
          />
          <button type="button" disabled={procesando} onClick={() => alCorregir(tarea)} className={BOTON}>
            Corregir
          </button>
        </>
      )}
    </div>
  );
}

/** El armazón entero de una prueba: decide, según modo y estado, cuál de las cuatro caras enseñar. */
export function HacerPrueba({ prueba }: { prueba: PruebaParaHacer }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [procesando, empezarTransicion] = useTransition();

  function alEmpezar() {
    empezarTransicion(async () => {
      const r = await empezarPruebaAccion(prueba.examen.id, prueba.prueba);
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  // El modo libre no tiene intento que abrir ni que cerrar: se corrige al
  // vuelo desde el primer momento, así que no pasa por el aviso previo.
  if (prueba.modo === "LIBRE") return <PruebaLibre prueba={prueba} />;
  if (prueba.estado.estado === "SIN_EMPEZAR") {
    return <AvisoPrevio prueba={prueba} alEmpezar={alEmpezar} enviando={procesando} error={error} />;
  }
  if (prueba.estado.estado === "ENTREGADA") return <PruebaEntregada prueba={prueba} />;
  return <PruebaHaciendo prueba={prueba} />;
}
