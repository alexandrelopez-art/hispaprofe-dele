"use client";

// Lo que no se puede olvidar de este componente:
//
// 1. El trozo se apunta como oído en el servidor ANTES de que suene, no
//    después. Recargar la página nunca puede devolver un trozo ya sonado, y
//    eso solo es cierto si la escritura ocurre antes que el `play()`.
// 2. El navegador no deja sonar audio sin un gesto del usuario que lo haya
//    precedido en esa pestaña. En la prueba con reloj ese gesto es el botón
//    «Empezar» del aviso previo; en modo libre no hay aviso previo, así que
//    el primer gesto es el propio botón de esta cinta — vale igual, y deja
//    que la reproducción encadenada siga sola después.
import { useEffect, useRef, useState } from "react";
import { limitesDelTrozo, siguienteTrozo } from "@/lib/examen/motor";

export const SEGUNDOS_DE_PAUSA = 10;

const CAJA = "flex flex-col gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-5";
const BOTON = "self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white";
const AVISO_DE_ERROR = "text-error-600";

type Estado =
  | { tipo: "listo" }
  | { tipo: "sonando" }
  | { tipo: "pausa"; segundos: number }
  | { tipo: "agotado" }
  | { tipo: "error" };

/**
 * La cinta de una tarea de auditiva: un trozo cada vez, apuntado en el
 * servidor antes de sonar (salvo en modo libre, donde no se raciona), con
 * una pausa entre trozos para contestar.
 */
export function Cinta({
  ficheroId,
  cortes,
  trozos,
  oidos,
  bloqueada,
  alSonar,
}: {
  ficheroId: string;
  cortes: number[];
  trozos: number;
  oidos: number[];
  bloqueada: boolean;
  /** Apunta el trozo en el servidor ANTES de que suene. Si falla, no suena. */
  alSonar: (trozo: number) => Promise<{ error?: string }>;
}) {
  const reproductor = useRef<HTMLAudioElement>(null);
  const hasta = useRef<number | null>(null);
  const [oidosState, setOidosState] = useState<number[]>(oidos);
  const [estado, setEstado] = useState<Estado>(() =>
    siguienteTrozo(oidos, trozos) === null && bloqueada ? { tipo: "agotado" } : { tipo: "listo" },
  );

  async function sonarTrozo(n: number) {
    // Se pone "sonando" ANTES de llamar a alSonar, no después: si no, un
    // doble clic mientras el marcado está en vuelo (el botón sigue visible
    // hasta que cambie el estado) dispararía sonarTrozo dos veces para el
    // mismo trozo.
    setEstado({ tipo: "sonando" });
    if (bloqueada) {
      const r = await alSonar(n);
      if (r.error) {
        setEstado({ tipo: "error" });
        return;
      }
    }
    setOidosState((o) => [...o, n]);
    const el = reproductor.current;
    if (!el) return;
    const limites = limitesDelTrozo(cortes, n);
    hasta.current = limites.hasta;
    el.currentTime = limites.desde;
    void el.play();
  }

  // Se llama tanto al pulsar «Escuchar el audio» / «Sigue» como al acabarse
  // la cuenta atrás sola: las dos son el mismo gesto de seguir adelante.
  function avanzar() {
    const n = siguienteTrozo(oidosState, trozos);
    if (n !== null) void sonarTrozo(n);
  }

  // Se llama al llegar al final de un trozo, tanto si lo corta el `pause()`
  // de `onTimeUpdate` (trozos que no son el último) como si lo corta el
  // propio fichero (`onEnded`, el último trozo, que suena hasta el final
  // real y nunca hasta una duración calculada).
  function trozoTerminado() {
    hasta.current = null;
    if (siguienteTrozo(oidosState, trozos) !== null) {
      setEstado({ tipo: "pausa", segundos: SEGUNDOS_DE_PAUSA });
    } else if (bloqueada) {
      setEstado({ tipo: "agotado" });
    } else {
      // Modo libre: la cinta no se acaba nunca, vuelve a estar lista.
      setOidosState([]);
      setEstado({ tipo: "listo" });
    }
  }

  // La cuenta atrás de la pausa entre trozos: un segundo por vuelta, y al
  // llegar a cero sigue sola sin que nadie tenga que tocar «Sigue».
  useEffect(() => {
    if (estado.tipo !== "pausa") return;
    const id = setTimeout(() => {
      if (estado.segundos <= 1) avanzar();
      else setEstado({ tipo: "pausa", segundos: estado.segundos - 1 });
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <section data-cinta className={CAJA}>
      <audio
        ref={reproductor}
        src={`/api/ficheros/${ficheroId}`}
        preload="auto"
        onTimeUpdate={(e) => {
          if (hasta.current !== null && e.currentTarget.currentTime >= hasta.current) {
            e.currentTarget.pause();
            trozoTerminado();
          }
        }}
        onEnded={trozoTerminado}
      />
      {estado.tipo === "error" && <p role="alert" className={AVISO_DE_ERROR}>No se pudo preparar el audio. Vuelve a entrar.</p>}
      {estado.tipo === "agotado" && <p>Este audio ya ha sonado.</p>}
      {estado.tipo === "sonando" && <p aria-live="polite">Sonando…</p>}
      {(estado.tipo === "listo" || estado.tipo === "pausa") && (
        <button type="button" onClick={avanzar} className={BOTON}>
          {estado.tipo === "pausa" ? `Sigue (${estado.segundos})` : "Escuchar el audio"}
        </button>
      )}
    </section>
  );
}
