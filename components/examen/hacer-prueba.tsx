"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Prueba } from "@/lib/generated/prisma";
import type { PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { NOMBRE_DE_PRUEBA } from "@/lib/dele/estructura";
import { estaEntregada, textoDelEstado } from "@/lib/examen/motor";
import { itemsDelFormulario } from "@/lib/taller/estado";
import {
  corregirEnLibreAccion,
  empezarPruebaAccion,
  entregarPruebaAccion,
  guardarRespuestaAccion,
  marcarTrozoAccion,
} from "@/app/examen/acciones";
import { Cinta } from "@/components/examen/cinta";
// Las piezas comunes con la escrita viven en su propio fichero: ver el
// comentario de piezas.tsx (era un círculo de imports entre las dos pantallas).
import { AVISO_DE_ERROR, BOTON, CAJA } from "@/components/examen/piezas";
import { PestanasDeTarea } from "@/components/examen/pestanas-de-tarea";
import { HacerEscrita } from "@/components/examen/hacer-escrita";
import { Reloj } from "@/components/examen/reloj";
import { CabeceraExamen } from "@/components/carcasa/cabecera-examen";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";

type Marcadas = Record<string, string>;
type NotaDeTarea = { aciertos: number; total: number; fallos: number[] };

function totalDePreguntas(tareas: TareaParaHacer[]): number {
  return tareas.reduce((n, t) => n + (t.regla.items ?? 0), 0);
}

/**
 * La cinta de una tarea, colgada por encima de la actividad cuando la tarea
 * lleva audio. `racionada` decide si suena racionado (la prueba de verdad,
 * un trozo cada vez, apuntado en el servidor) o libre (práctica, sin
 * racionar): la decide el armazón según el modo, no la propia cinta. No se
 * llama `bloqueada` a propósito: en `PruebaHaciendo` esa palabra ya significa
 * «no se puede contestar», y aquí significaría otra cosa distinta a la vez.
 * `entregada` la pinta agotada sin más, sin importar lo que digan `oidos` o
 * `trozos`: en la prueba ya entregada, marcar un trozo siempre fallaría.
 *
 * En las TRES llamadas de abajo va con `key={tarea.numero}`: sin esa key,
 * cambiar de pestaña de tarea no remonta esta cinta (sigue en el mismo sitio
 * del árbol, solo le cambian las props), y sus dos `useState` — los que
 * siembran `oidos` y calculan si ya está agotada — no se vuelven a ejecutar.
 * Una sola cinta serviría entonces a las cuatro tareas con el estado de la
 * primera: la tarea 2 aparecería «ya sonada» sin haber sonado nunca, y el
 * botón de la tarea 4 podría marcar el trozo de la tarea 3. La key parece
 * de sobra — no lo es.
 */
function CintaDeLaTarea({
  examenId, prueba, tarea, racionada, entregada, avisarSiSuena,
}: {
  examenId: string;
  prueba: Prueba;
  tarea: TareaParaHacer;
  racionada: boolean;
  entregada?: boolean;
  avisarSiSuena?: (sonando: boolean) => void;
}) {
  const audio = tarea.formulario.medios.audio;
  if (tarea.trozos <= 0 || !audio) return null;
  return (
    <Cinta
      ficheroId={audio.fichero}
      cortes={audio.cortes}
      trozos={tarea.trozos}
      oidos={tarea.oidos}
      racionada={racionada}
      entregada={entregada}
      alSonar={marcarTrozoAccion.bind(null, examenId, prueba, tarea.numero)}
      avisarSiSuena={avisarSiSuena}
    />
  );
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
    <>
      {/* Antes de empezar no hay nada en juego: Salir es un enlace, sin pregunta. */}
      <CabeceraExamen prueba={prueba.prueba} tarea={null} reloj={null} preguntar={false} />
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
    </>
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
  // Lo dice la cinta de la tarea abierta (ver PestanasDeTarea): mientras un
  // trozo racionado suena, no se cambia de tarea.
  const [cintaSonando, setCintaSonando] = useState(false);
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
    // El reloj avisó por su cuenta: se entrega y se refresca (esto no pasa por
    // un formulario, así que Next no lo revalida solo). Que la entrega quede
    // «por tiempo» lo decide el servidor mirando su propio reloj, no este aviso.
    empezarTransicion(async () => {
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      // Se refresca TAMBIÉN cuando hay error, y no es un descuido: los dos
      // errores que pueden llegar aquí («Se acabó el tiempo.» y «Esta prueba
      // ya está entregada.») significan lo mismo del lado del servidor —la
      // prueba YA está entregada y con su nota puesta—, porque la guarda de
      // abrirLaPrueba cierra el intento antes de devolverlos. Sin el refresco,
      // el estudiante se quedaba con una nota calculada que no podía ver, el
      // reloj no volvía a intentarlo (el pestillo ya está echado) y «Entregar»
      // daba una y otra vez el mismo error. Se enseña el aviso por si el
      // refresco no llega a llevarnos a ninguna parte.
      if (r.error) setError(r.error);
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
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      // Igual que en alAcabarse: el error que llega aquí ya lleva la prueba
      // entregada por detrás, así que refrescar es lo que lleva a la pantalla
      // del resultado en vez de a un callejón.
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];

  return (
    <div className="flex flex-col gap-4">
      <CabeceraExamen
        prueba={prueba.prueba}
        tarea={tarea ? { actual: tarea.numero, total: prueba.tareas.length } : null}
        reloj={
          prueba.minutos !== null && prueba.segundosQueQuedan !== null ? (
            <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} />
          ) : null
        }
        preguntar
      />
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} bloqueadas={cintaSonando} />
      {tarea && (
        <>
          {/* key: load-bearing, ver el comentario de CintaDeLaTarea — sin ella,
              cambiar de pestaña reutiliza la cinta de la tarea anterior. */}
          <CintaDeLaTarea
            key={tarea.numero}
            examenId={examenId}
            prueba={prueba.prueba}
            tarea={tarea}
            racionada
            avisarSiSuena={setCintaSonando}
          />
          <TareaDelEstudiante tarea={tarea} marcadas={marcadas} fallos={null} bloqueada={bloqueadaPorError} alMarcar={alMarcar} />
        </>
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
/** Lo que sacó en cada tarea: sus preguntas menos las que falló. */
function notaDeCadaTarea(prueba: PruebaParaHacer): { numero: number; aciertos: number; total: number }[] {
  return prueba.tareas.map((t) => {
    const numeros = itemsDelFormulario(t.formulario);
    const fallos = numeros.filter((n) => prueba.fallos.includes(n)).length;
    return { numero: t.numero, aciertos: numeros.length - fallos, total: numeros.length };
  });
}

/**
 * La cabecera del resultado. Antes era una línea suelta —«Entregada, 19 de
 * 25»— y el profesor dijo que no se entendía: no decía de qué prueba era, ni
 * dónde se habían perdido los puntos, ni qué significaba el rojo de abajo, ni
 * qué quedaba por hacer. Todo eso ya lo sabemos, solo había que decirlo.
 */
function Resultado({ prueba }: { prueba: PruebaParaHacer }) {
  const porTarea = notaDeCadaTarea(prueba);
  const queda = prueba.otras.filter((o) => !estaEntregada(o.estado));
  return (
    <section className={CAJA}>
      <p className="text-tinta-suave">
        {NOMBRE_DE_PRUEBA[prueba.prueba]} · {prueba.examen.titulo}
      </p>
      <p className="text-3xl font-extrabold">
        {prueba.estado.aciertos} de {prueba.estado.total}
      </p>
      {prueba.estado.porTiempo && <p className="text-tinta-suave">Se entregó sola: se acabó el tiempo.</p>}

      <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
        {porTarea.map((t) => (
          <li key={t.numero} className="flex justify-between gap-2">
            <span>Tarea {t.numero}</span>
            <span className="font-bold">
              {t.aciertos} de {t.total}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-tinta-suave">
        En rojo, las que fallaste. No se dice cuál era la buena: vuelve al texto y búscala.
      </p>

      {/* Ni el número de pruebas ni el singular se escriben a mano: `otras` son
          dos desde que la escrita tiene pantalla (antes una), y serán tres con
          la oral. «Ya has terminado las dos pruebas» ya era falso. */}
      {queda.length > 0 ? (
        <p>
          {queda.length === 1 ? "Te queda" : "Te quedan"}{" "}
          {queda.map((o) => NOMBRE_DE_PRUEBA[o.prueba]).join(" y ")}.{" "}
          <Link href="/" className="text-hp-600 underline">
            {queda.length === 1 ? "Ir a hacerla" : "Ir a hacerlas"}
          </Link>
        </p>
      ) : (
        <p className="font-bold">Ya has terminado el examen.</p>
      )}
    </section>
  );
}

function PruebaEntregada({ prueba }: { prueba: PruebaParaHacer }) {
  const examenId = prueba.examen.id;
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  return (
    <div className="flex flex-col gap-4">
      <Resultado prueba={prueba} />
      <p className="font-bold">Repasa tus respuestas:</p>
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <>
          {/* key: load-bearing, ver el comentario de CintaDeLaTarea. `entregada`
              la pinta agotada sin más: aquí ningún clic va a salir bien. */}
          <CintaDeLaTarea key={tarea.numero} examenId={examenId} prueba={prueba.prueba} tarea={tarea} racionada entregada />
          <TareaDelEstudiante tarea={tarea} marcadas={prueba.respuestas} fallos={prueba.fallos} bloqueada alMarcar={() => {}} />
        </>
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
      <CabeceraExamen prueba={prueba.prueba} tarea={tarea ? { actual: tarea.numero, total: prueba.tareas.length } : null} reloj={null} preguntar />
      <p className="text-sm text-tinta-suave">Práctica libre: puedes corregir cada tarea tantas veces como quieras.</p>
      {notaDeLaTarea && <p className="text-xl font-bold">{notaDeLaTarea.aciertos} de {notaDeLaTarea.total}</p>}
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <>
          {/* key: load-bearing, ver el comentario de CintaDeLaTarea — sin ella,
              cambiar de pestaña reutiliza la cinta de la tarea anterior. */}
          <CintaDeLaTarea key={tarea.numero} examenId={examenId} prueba={prueba.prueba} tarea={tarea} racionada={false} />
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

  // La escrita tiene sus propias caras: un folio no se parece en nada a
  // veinticinco letras marcadas, y meterla en PruebaHaciendo obligaría a que
  // cada rama de allí preguntara de qué prueba se trata. Como aquí, cada cara
  // de la escrita pinta su propia CabeceraExamen.
  if (prueba.prueba === "EE") return <HacerEscrita prueba={prueba} />;

  // El modo libre no tiene intento que abrir ni que cerrar: se corrige al
  // vuelo desde el primer momento, así que no pasa por el aviso previo.
  const cara =
    prueba.modo === "LIBRE" ? <PruebaLibre prueba={prueba} />
    : prueba.estado.estado === "SIN_EMPEZAR" ? <AvisoPrevio prueba={prueba} alEmpezar={alEmpezar} enviando={procesando} error={error} />
    : estaEntregada(prueba.estado) ? <PruebaEntregada prueba={prueba} />
    : <PruebaHaciendo prueba={prueba} />;

  // Sin salida aquí: cada cara sin entregar pinta su CabeceraExamen (la tarea
  // abierta es estado de la cara), y la entregada lleva la cabecera del sitio,
  // que pinta la página.
  return <div className="flex flex-col gap-4">{cara}</div>;
}
