"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { NOMBRE_DE_PRUEBA } from "@/lib/dele/estructura";
import { textoDelEstado } from "@/lib/examen/motor";
import {
  corregirEnLibreAccion,
  empezarPruebaAccion,
  entregarPruebaAccion,
  guardarRespuestaAccion,
} from "@/app/examen/acciones";
import { Reloj } from "@/components/examen/reloj";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";

type Marcadas = Record<string, string>;

const CAJA = "flex min-w-0 flex-col gap-4 rounded-2xl border border-tinta-suave/20 bg-white p-5";
const BOTON = "self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50";
const AVISO_DE_ERROR = "rounded-2xl bg-error-100 p-4 text-error-600";

function totalDePreguntas(tareas: TareaParaHacer[]): number {
  return tareas.reduce((n, t) => n + (t.regla.items ?? 0), 0);
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
  const esLectura = prueba.minutos !== null;
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

  function alMarcar(numero: number, letra: string) {
    // Se pinta en el acto; la llamada al servidor va detrás, y solo si falla
    // deja de aceptar respuestas (bloqueadaPorError).
    setMarcadas((m) => ({ ...m, [String(numero)]: letra }));
    empezarTransicion(async () => {
      const r = await guardarRespuestaAccion(examenId, prueba.prueba, numero, letra);
      if (r.error) {
        setError(r.error);
        setBloqueadaPorError(true);
      }
    });
  }

  function alAcabarse() {
    // El reloj avisó por su cuenta: se entrega con porTiempo y se refresca
    // (esto no pasa por un formulario, así que Next no lo revalida solo).
    empezarTransicion(async () => {
      await entregarPruebaAccion(examenId, prueba.prueba, true);
      router.refresh();
    });
  }

  function alEntregar() {
    const total = totalDePreguntas(prueba.tareas);
    const sinMarcar = total - Object.keys(marcadas).length;
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
      <button type="button" disabled={bloqueadaPorError || procesando} onClick={alEntregar} className={BOTON}>
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
 * ni el uno ni el otro tienen sentido. En su lugar, «Corregir» por tarea:
 * corrige TODO lo marcado hasta ahora (la clave nunca baja al navegador), y
 * se puede repetir tantas veces como se quiera.
 */
function PruebaLibre({ prueba }: { prueba: PruebaParaHacer }) {
  const examenId = prueba.examen.id;
  const [marcadas, setMarcadas] = useState<Marcadas>(prueba.respuestas);
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const [nota, setNota] = useState<{ aciertos: number; total: number } | null>(null);
  const [fallos, setFallos] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, empezarTransicion] = useTransition();

  function alMarcar(numero: number, letra: string) {
    setMarcadas((m) => ({ ...m, [String(numero)]: letra }));
    // La corrección anterior ya no vale para lo que se acaba de cambiar.
    setNota(null);
    setFallos(null);
  }

  function alCorregir() {
    empezarTransicion(async () => {
      const r = await corregirEnLibreAccion(examenId, prueba.prueba, marcadas);
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setNota({ aciertos: r.aciertos, total: r.total });
      setFallos(r.fallos.map((f) => f.numero));
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">Práctica libre: puedes corregir tantas veces como quieras.</p>
      {nota && <p className="text-xl font-bold">{nota.aciertos} de {nota.total}</p>}
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <TareaDelEstudiante tarea={tarea} marcadas={marcadas} fallos={fallos} bloqueada={false} alMarcar={alMarcar} />
      )}
      <button type="button" disabled={procesando} onClick={alCorregir} className={BOTON}>
        Corregir
      </button>
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
