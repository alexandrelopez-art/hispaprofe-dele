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
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";

export const SEGUNDOS_DE_PAUSA = 10;

type Estado =
  | { tipo: "listo" }
  | { tipo: "sonando" }
  | { tipo: "pausa"; segundos: number }
  | { tipo: "agotado" }
  | { tipo: "error" };

/**
 * Los límites que llegaron son de fiar: ni `desde` ni `hasta` son
 * `undefined`. Solo puede pasar si `cortes` no cuadra con `trozos` (un
 * formulario mal guardado) — esta pantalla no puede arreglar esos datos,
 * solo negarse a poner `el.currentTime = undefined` y reventar en silencio.
 */
function limitesValidos(l: { desde: number; hasta: number | null }): boolean {
  return Number.isFinite(l.desde) && (l.hasta === null || Number.isFinite(l.hasta));
}

/**
 * La cinta de una tarea de auditiva: un trozo cada vez, apuntado en el
 * servidor antes de sonar (salvo cuando `racionada` es `false`), con una
 * pausa entre trozos para contestar.
 */
export function Cinta({
  ficheroId,
  cortes,
  trozos,
  oidos,
  racionada,
  entregada = false,
  alSonar,
  avisarSiSuena,
}: {
  ficheroId: string;
  cortes: number[];
  trozos: number;
  oidos: number[];
  /**
   * `true`: la prueba de verdad — un trozo se marca en el servidor ANTES de
   * sonar y no vuelve a sonar. `false`: modo libre — no se escribe nada y los
   * trozos se repiten. Nombrarlo aparte de `bloqueada` (que en esta misma
   * pantalla significa «no se puede contestar») es a propósito: los dos
   * booleanos no dicen lo mismo, aunque en `PruebaHaciendo` valgan `true` y
   * `false` a la vez sin ser el mismo concepto.
   */
  racionada: boolean;
  /**
   * La prueba ya se entregó: el intento está cerrado y CUALQUIER intento de
   * marcar un trozo fallaría en el servidor (`YA_ENTREGADA`), así que aquí no
   * hay clic que pueda salir bien. Se pinta agotada de entrada, sin botón, y
   * sin tocar `alSonar` ni el `<audio>` — «Vuelve a entrar» no es un consejo
   * que se pueda seguir en una prueba ya entregada.
   */
  entregada?: boolean;
  /** Apunta el trozo en el servidor ANTES de que suene. Si falla, no suena. */
  alSonar: (trozo: number) => Promise<{ error?: string }>;
  /**
   * Avisa al armazón de que HAY UN TROZO RACIONADO SONANDO: es el rato en el
   * que desmontar esta cinta (cambiar de pestaña de tarea) quema el trozo sin
   * devolverlo, porque ya quedó apuntado en el servidor antes de sonar. El
   * armazón apaga con esto las pestañas. Solo es `true` si `racionada`: en
   * modo libre el trozo se repite y no hay nada que quemar.
   */
  avisarSiSuena?: (sonando: boolean) => void;
}) {
  const reproductor = useRef<HTMLAudioElement>(null);
  const hasta = useRef<number | null>(null);
  // Solo se siembra desde el servidor cuando raciona: en modo libre nunca se
  // escribe nada (hoy `oidos` ya llega vacío en ese caso), pero sembrar igual
  // desde `oidos` sería, si eso cambiara alguna vez, resucitar el racionamiento
  // que el modo libre existe para no tener.
  const [oidosState, setOidosState] = useState<number[]>(racionada ? oidos : []);
  const [estado, setEstado] = useState<Estado>(() =>
    siguienteTrozo(oidos, trozos) === null && racionada ? { tipo: "agotado" } : { tipo: "listo" },
  );

  async function sonarTrozo(n: number) {
    // Se pone "sonando" ANTES de llamar a alSonar, no después: si no, un
    // doble clic mientras el marcado está en vuelo (el botón sigue visible
    // hasta que cambie el estado) dispararía sonarTrozo dos veces para el
    // mismo trozo.
    setEstado({ tipo: "sonando" });
    if (racionada) {
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
    // El trozo ya quedó marcado arriba: si los límites no cuadran (`cortes`
    // desajustado de `trozos`), no se calla — se avisa, aunque ya esté escrito.
    if (!limitesValidos(limites)) {
      setEstado({ tipo: "error" });
      return;
    }
    hasta.current = limites.hasta;
    el.currentTime = limites.desde;
    // Autoplay rechazado, fichero que da 404, decodificación que falla: el
    // trozo ya está marcado, así que un rechazo silencioso lo quemaría sin
    // que sonara y sin ningún botón para reintentar. Se avisa en vez de callar.
    el.play().catch(() => setEstado({ tipo: "error" }));
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
    } else if (racionada) {
      setEstado({ tipo: "agotado" });
    } else {
      // Modo libre: la cinta no se acaba nunca, vuelve a estar lista.
      setOidosState([]);
      setEstado({ tipo: "listo" });
    }
  }

  // La cuenta atrás de la pausa entre trozos: un segundo por vuelta, y al
  // llegar a cero sigue sola sin que nadie tenga que tocar «Sigue». Solo
  // depende de `estado`, no de `avanzar` (ni de lo que `avanzar` cierra por
  // encima: `racionada`, `oidosState`, `trozos`, `cortes`, `alSonar`): es
  // correcto hoy porque `estado` cambia en CADA vuelta del segundero, así que
  // el efecto se desmonta y se vuelve a montar cada segundo y cierra sobre
  // los valores más recientes de camino — no porque listar solo `estado` sea
  // en general válido.
  useEffect(() => {
    if (estado.tipo !== "pausa") return;
    const id = setTimeout(() => {
      if (estado.segundos <= 1) avanzar();
      else setEstado({ tipo: "pausa", segundos: estado.segundos - 1 });
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // Mientras un trozo racionado suena, el armazón tiene que impedir que se
  // cambie de tarea: el trozo ya está apuntado en el servidor y desmontar esta
  // cinta lo quemaría sin haberlo oído. El aviso sale de aquí porque es aquí
  // donde se sabe; la decisión de qué apagar es del armazón. El `false` de la
  // limpieza cubre el desmontaje (salir de la pantalla) y se pisa en el acto
  // con el valor nuevo cuando lo que cambió fue el estado.
  useEffect(() => {
    avisarSiSuena?.(racionada && estado.tipo === "sonando");
    return () => avisarSiSuena?.(false);
  }, [racionada, estado.tipo, avisarSiSuena]);

  // Al desmontar (cambiar de tarea, salir de la pantalla) el audio se para a
  // mano: quitar el `<audio>` del DOM ya lo pararía solo, pero no conviene
  // depender de eso.
  useEffect(() => {
    const el = reproductor.current;
    return () => {
      el?.pause();
    };
  }, []);

  if (entregada) {
    // Agotada de entrada, sin importar lo que digan `oidos` o `trozos`: un
    // estudiante puede entregar sin haber oído las cuatro tareas, y aquí no
    // hay ningún clic que el servidor vaya a aceptar.
    return (
      <section data-cinta>
        <Tarjeta className="flex flex-col gap-3">
          <p>Este audio ya ha sonado.</p>
        </Tarjeta>
      </section>
    );
  }

  return (
    <section data-cinta>
      <Tarjeta className="flex flex-col gap-3">
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
          onError={() => setEstado({ tipo: "error" })}
        />
        {estado.tipo === "error" && <Aviso tono="error">No se pudo preparar el audio. Vuelve a entrar.</Aviso>}
        {estado.tipo === "agotado" && <p>Este audio ya ha sonado.</p>}
        {estado.tipo === "sonando" && <p aria-live="polite">Sonando…</p>}
        {(estado.tipo === "listo" || estado.tipo === "pausa") && (
          <Boton onClick={avanzar} className="self-start">
            {estado.tipo === "pausa" ? `Sigue (${estado.segundos})` : "Escuchar el audio"}
          </Boton>
        )}
      </Tarjeta>
    </section>
  );
}
