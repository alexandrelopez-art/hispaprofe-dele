"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EscritoParaHacer, PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { BANDA_MAXIMA, CRITERIOS_EE, NOMBRE_DE_PRUEBA } from "@/lib/dele/estructura";
import { estaEntregada, SE_ACABO_EL_TIEMPO } from "@/lib/examen/motor";
import { empezarPruebaAccion, entregarPruebaAccion, guardarEscritoAccion } from "@/app/examen/acciones";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import { Folio, type Rango } from "@/components/examen/folio";
import { AVISO_DE_ERROR, BOTON, BOTON_SUAVE, CAJA, PestanasDeTarea, VolverAInicio } from "@/components/examen/piezas";
import { Reloj } from "@/components/examen/reloj";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";

/** Lo que el estudiante lleva escrito en UNA tarea: su folio y, si la tarea
 *  tiene opciones, sobre cuál escribe. */
export type Borrador = { texto: string; opcion: number | null };

const BORRADOR_VACIO: Borrador = { texto: "", opcion: null };

/** Los dos segundos de calma antes de mandar el borrador al servidor. */
const CALMA = 2000;

/**
 * El tope: aunque no haya dos segundos de calma, se guarda igual cada quince
 * segundos. Sin él, quien escribe sin levantar los dedos reinicia el
 * temporizador con cada tecla y no guarda en varios minutos — justo el
 * estudiante aplicado, y justo en la prueba donde todo es teclear.
 */
const TOPE = 15_000;

/** Nada que mandar si no ha cambiado nada desde el último guardado. */
export function hayQueGuardar(guardado: Borrador, actual: Borrador): boolean {
  return guardado.texto !== actual.texto || guardado.opcion !== actual.opcion;
}

/**
 * ¿Queda algo sin mandar, en CUALQUIERA de las tareas? Es lo que decide el
 * cartelito: decir «Guardado» con texto sin guardar es peor que no decir nada,
 * porque es justo lo que invita a cerrar la pestaña.
 */
export function hayAlgoSinGuardar(
  guardados: Record<number, Borrador>,
  actuales: Record<number, Borrador>,
): boolean {
  return Object.keys(actuales).some((tarea) =>
    hayQueGuardar(guardados[Number(tarea)] ?? BORRADOR_VACIO, actuales[Number(tarea)] ?? BORRADOR_VACIO));
}

/**
 * Lo que le falta antes de entregar, en palabras suyas. Mira las dos cosas que
 * se pueden quedar a medias: el folio en blanco y, en una tarea con opciones,
 * no haber elegido ninguna.
 */
export function loQueFalta(prueba: PruebaParaHacer, borradores: Record<number, Borrador>): string[] {
  const falta: string[] = [];
  for (const tarea of prueba.tareas) {
    const b = borradores[tarea.numero] ?? BORRADOR_VACIO;
    if (b.texto.trim() === "") falta.push(`la tarea ${tarea.numero} está en blanco`);
    else if (tarea.formulario.forma === "REDACCION_DOS" && b.opcion === null) {
      falta.push(`no has elegido opción en la tarea ${tarea.numero}`);
    }
  }
  return falta;
}

/** «a», «a y b», «a, b y c». Lo lee un chaval de catorce años justo antes de
 *  entregar: ahí no valen las listas pegadas con comas. */
export function enLista(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  return `${cosas.slice(0, -1).join(", ")} y ${cosas[cosas.length - 1]}`;
}

/**
 * ¿Este error del servidor apaga los folios? SOLO el del tiempo. Es el único
 * que significa que la prueba ya está cerrada y que seguir escribiendo es
 * escribir en el aire.
 *
 * Los otros cuatro que `guardarEscrito` puede devolver —texto demasiado largo,
 * tarea u opción que no existen, examen retirado— son rechazos de ESTE
 * guardado, y varios se arreglan escribiendo: apagar el folio con ellos deja
 * al estudiante encerrado con el aviso y sin poder ni seguir ni recortar. El
 * pegado largo era el caso agudo: «Ese texto es demasiado largo.» y el folio
 * apagado con el texto largo dentro.
 */
export function apagaLosFolios(mensaje: string): boolean {
  return mensaje === SE_ACABO_EL_TIEMPO;
}

/**
 * Un borrador por TAREA, no por escrito guardado: se recorren las tareas y se
 * les busca su fila. La tarea que todavía no se ha tocado no tiene fila en la
 * base, y sin esto su folio nacería `undefined`.
 */
export function borradoresDe(prueba: PruebaParaHacer): Record<number, Borrador> {
  const borradores: Record<number, Borrador> = {};
  for (const tarea of prueba.tareas) {
    const escrito = prueba.escritos.find((e) => e.tarea === tarea.numero);
    borradores[tarea.numero] = { texto: escrito?.texto ?? "", opcion: escrito?.opcion ?? null };
  }
  return borradores;
}

/**
 * Las dos únicas formas de tocar un borrador, y están aquí fuera —no dentro de
 * un `onChange`— porque la regla que guardan es justo la que se rompe sola:
 * el texto es de la TAREA y la opción es una marca al lado. Elegir otro tema no
 * borra el folio, y seguir escribiendo no desmarca el tema.
 */
export function conTexto(borrador: Borrador, texto: string): Borrador {
  return { ...borrador, texto };
}

export function conOpcion(borrador: Borrador, opcion: number): Borrador {
  return { ...borrador, opcion };
}

/**
 * Corregida de verdad: el profesor FIRMÓ (`corregidaEn`) y la nota está puesta
 * ENTERA. Las tres condiciones hacen falta y cada una tapa un agujero distinto:
 * sin firma, las bandas ni siquiera han salido de `pruebaParaHacer` y la cara
 * pintaría cuatro ceros; sin `aciertos`, la cabecera diría «null de 24»; sin
 * `total`, «18 de null».
 */
export function estaCorregida(prueba: PruebaParaHacer): boolean {
  return prueba.corregidaEn !== null && prueba.estado.aciertos !== null && prueba.estado.total !== null;
}

/** Cuántas palabras piden en esta tarea. Solo las redacciones lo dicen. */
function rangoDe(tarea: TareaParaHacer): Rango {
  const f = tarea.formulario;
  if (f.forma === "REDACCION_UNA" || f.forma === "REDACCION_DOS") return f.actividad.palabras;
  return { min: null, max: null };
}

const escritoDe = (prueba: PruebaParaHacer, tarea: number): EscritoParaHacer | undefined =>
  prueba.escritos.find((e) => e.tarea === tarea);

/** Qué enseña el cartelito del guardado. `nada` = callado, que es como nace. */
type EstadoDelGuardado = "nada" | "pendiente" | "guardando" | "hecho";

const TEXTO_DEL_GUARDADO: Record<EstadoDelGuardado, string | null> = {
  nada: null,
  pendiente: "Sin guardar…",
  guardando: "Guardando…",
  hecho: "Guardado",
};

/**
 * El almacén de borradores de la escrita: lo que hay escrito, lo que el
 * servidor ya tiene, y todas las formas en que lo uno acaba siendo lo otro.
 *
 * Está aquí fuera, y no dentro de `EscritaHaciendo`, porque son cinco caminos
 * distintos hacia el mismo guardado —el temporizador, el cambio de pestaña, la
 * entrega, el desmontaje y el `pagehide`— y repartidos por una pantalla de
 * doscientas líneas se olvida uno. Perder lo escrito por una redacción de un
 * chaval no se arregla después.
 *
 * `alFallar` avisa de lo que el servidor rechace. Se guarda en una ref y no
 * viaja en las dependencias de nada (igual que `<Reloj>` hace con `alAcabarse`):
 * así quien lo llama puede pasar una función nueva en cada render sin rearmar
 * los temporizadores de aquí dentro.
 */
export function useBorradores(prueba: PruebaParaHacer, tareaAbierta: number, alFallar: (mensaje: string) => void) {
  const examenId = prueba.examen.id;
  const [borradores, setBorradores] = useState<Record<number, Borrador>>(() => borradoresDe(prueba));
  const [estado, setEstado] = useState<EstadoDelGuardado>("nada");
  // Lo último tecleado, sin pasar por el ciclo de pintado: es lo que lee la
  // descarga del desmontaje, que ocurre cuando ya no hay más renders.
  const ultimo = useRef<Record<number, Borrador>>(borradoresDe(prueba));
  // Lo que el servidor YA tiene. En una ref y no en estado: no se pinta, y si
  // fuera estado cada guardado provocaría otro render y con él otro temporizador.
  const guardadoEnServidor = useRef<Record<number, Borrador>>(borradoresDe(prueba));
  // Cuándo se mandó algo por última vez, para el tope. Empieza en null y no en
  // `Date.now()`: leer el reloj mientras se pinta es impuro (lo caza el lint del
  // compilador de React) y además no hace falta, porque el tope solo cuenta
  // desde que hay algo que mandar. Se siembra en el efecto de abajo.
  const horaDelUltimoGuardado = useRef<number | null>(null);
  const avisar = useRef(alFallar);
  useEffect(() => {
    avisar.current = alFallar;
  }, [alFallar]);

  /**
   * Manda el borrador de una tarea, y solo si ha cambiado. Devuelve el error si
   * lo hubo, para que quien llama decida: la entrega a mano se para, la entrega
   * por reloj sigue, y el temporizador lo enseña y apaga los folios.
   */
  const guardar = useCallback(async (tarea: number): Promise<string | null> => {
    const b = ultimo.current[tarea] ?? BORRADOR_VACIO;
    const yaEstaba = guardadoEnServidor.current[tarea] ?? BORRADOR_VACIO;
    if (!hayQueGuardar(yaEstaba, b)) return null;
    // Se apunta ANTES de la vuelta del servidor: mientras esta llamada está en
    // el aire, otra tecla puede armar un segundo temporizador, y sin esto las
    // dos mandarían lo mismo. Si falla, se deshace.
    guardadoEnServidor.current = { ...guardadoEnServidor.current, [tarea]: b };
    horaDelUltimoGuardado.current = Date.now();
    setEstado("guardando");
    const r = await guardarEscritoAccion(examenId, tarea, b.texto, b.opcion);
    if (r.error) {
      guardadoEnServidor.current = { ...guardadoEnServidor.current, [tarea]: yaEstaba };
      setEstado("pendiente");
      return r.error;
    }
    // «Guardado» solo si de verdad no queda nada: mientras esta llamada viajaba
    // se ha podido teclear más, y decir «Guardado» con texto sin mandar es
    // exactamente lo que hace que alguien cierre la pestaña y lo pierda.
    setEstado(hayAlgoSinGuardar(guardadoEnServidor.current, ultimo.current) ? "pendiente" : "hecho");
    return null;
  }, [examenId]);

  /** El guardado de siempre: si el servidor dice que no, avisa quien nos llamó. */
  const guardarYAvisar = useCallback((tarea: number) => {
    void guardar(tarea).then((fallo) => {
      if (fallo) avisar.current(fallo);
    });
  }, [guardar]);

  const abierto = borradores[tareaAbierta] ?? BORRADOR_VACIO;

  // El borrador viaja al servidor dos segundos después de dejar de teclear, y
  // como muy tarde cada TOPE aunque no se pare nunca. No en cada tecla: serían
  // cientos de escrituras por redacción. El temporizador se limpia al desmontar
  // (y lo pendiente lo manda entonces el efecto de descarga de abajo).
  //
  // Las dependencias son el texto y la opción sueltos, no el objeto borrador:
  // el objeto se construye en cada render y el temporizador volvería a empezar
  // de cero cada vez que la pantalla se repintara por cualquier otra cosa.
  const { texto: textoAbierto, opcion: opcionAbierta } = abierto;
  useEffect(() => {
    const actual = { texto: textoAbierto, opcion: opcionAbierta };
    if (!hayQueGuardar(guardadoEnServidor.current[tareaAbierta] ?? BORRADOR_VACIO, actual)) return;
    horaDelUltimoGuardado.current ??= Date.now();
    const loQueQuedaDelTope = TOPE - (Date.now() - horaDelUltimoGuardado.current);
    const espera = Math.max(0, Math.min(CALMA, loQueQuedaDelTope));
    const t = setTimeout(() => { guardarYAvisar(tareaAbierta); }, espera);
    return () => clearTimeout(t);
  }, [textoAbierto, opcionAbierta, tareaAbierta, guardarYAvisar]);

  /** Todo lo que quede sin mandar, de todas las tareas, ya. */
  const descargar = useCallback(() => {
    for (const tarea of Object.keys(ultimo.current)) void guardar(Number(tarea));
  }, [guardar]);

  // La descarga: lo pendiente se manda por DOS caminos, y cada uno cubre una
  // salida. Qué cubre cada cosa, exactamente:
  //
  // - El desmontaje, que NO es raro: «← Volver a Inicio» es un <Link>, o sea una
  //   navegación de cliente —la pantalla se desmonta, la aplicación sigue viva—,
  //   y es justo la salida que la pantalla anima a usar. Sin esto, los hasta dos
  //   segundos pendientes no llegaban nunca.
  // - `pagehide`: cerrar la pestaña, recargar o navegar fuera del sitio, donde
  //   ya no va a haber desmontaje de React que valga.
  //
  // Lo que NO cubre, y es a propósito: cambiar de aplicación o bloquear la
  // pantalla del móvil. Eso dispara `visibilitychange` a `hidden`, y Chrome en
  // Android no garantiza `pagehide` ahí; como además los temporizadores se
  // congelan, lo que se pierde no son dos segundos, es todo lo escrito desde el
  // último guardado. Está DECIDIDO que se pierda: la redacción se hace de una
  // sentada, y que salirse cueste es el aviso de que esto es un examen. NO es
  // un descuido, así que no se «arregla» añadiendo aquí un oyente de
  // `visibilitychange`.
  //
  // El otro límite, este sí técnico: el guardado es una acción de servidor y una
  // acción de servidor NO se puede mandar por `navigator.sendBeacon`, que es lo
  // único que el navegador promete entregar aunque la página se muera. Una
  // petición lanzada al cerrar la puede matar el navegador a medias, y entonces
  // se pierde igual; el tope de quince segundos acota cuánto.
  useEffect(() => {
    window.addEventListener("pagehide", descargar);
    return () => {
      window.removeEventListener("pagehide", descargar);
      descargar();
    };
  }, [descargar]);

  /** Tocar un borrador: se apunta primero en la ref (la fuente) y luego en el
   *  estado (la copia que se pinta), y el cartelito pasa a «Sin guardar…». */
  const cambiar = useCallback((tarea: number, nuevo: (b: Borrador) => Borrador) => {
    const siguiente = { ...ultimo.current, [tarea]: nuevo(ultimo.current[tarea] ?? BORRADOR_VACIO) };
    ultimo.current = siguiente;
    setBorradores(siguiente);
    setEstado("pendiente");
  }, []);

  const escribir = useCallback((tarea: number, texto: string) => {
    cambiar(tarea, (b) => conTexto(b, texto));
  }, [cambiar]);

  const elegir = useCallback((tarea: number, opcion: number) => {
    // conOpcion, y no un borrador nuevo: cambiar de tema NO borra el folio.
    cambiar(tarea, (b) => conOpcion(b, opcion));
  }, [cambiar]);

  return { borradores, abierto, estado, escribir, elegir, guardar, guardarYAvisar };
}

/**
 * El aviso previo de la escrita. En un examen de verdad dice las dos cosas que
 * la separan de la lectura: que el reloj la entrega sola (eso lo comparten) y
 * que la nota no sale al entregar, porque la pone una persona. En práctica
 * libre no hay reloj —se escribe sin cronómetro—, pero el resto es IGUAL: se
 * guarda, se manda cuando el estudiante quiera y entra en la cola del
 * profesor igual que en un examen de verdad; por eso el aviso dice que, en
 * cuanto se manda, ya no se puede cambiar (spec §9: la escrita es la única
 * prueba que en libre crea intento y se entrega de verdad). Un chico que
 * entrega y no ve nota se cree que algo se ha roto: por eso se avisa ANTES.
 */
function AvisoDeLaEscrita({
  prueba, alEmpezar, enviando, error,
}: {
  prueba: PruebaParaHacer;
  alEmpezar: () => void;
  enviando: boolean;
  error: string | null;
}) {
  const libre = prueba.modo === "LIBRE";
  return (
    <section className={CAJA}>
      <h1 className="text-xl font-bold">
        {prueba.examen.titulo} · {NOMBRE_DE_PRUEBA[prueba.prueba]}
      </h1>
      {libre ? (
        <p>
          Esto es práctica: escribes <strong>sin reloj</strong> y lo mandas cuando quieras. Cuando lo mandes, ya no
          se puede cambiar.
        </p>
      ) : (
        <p>Tienes {prueba.minutos} minutos. Cuando se acaben, la prueba se entrega ella sola: no se puede repetir.</p>
      )}
      <p>Lo que escribas se va guardando mientras escribes. La nota no sale al entregar: la pone tu profesor.</p>
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <button type="button" disabled={enviando} onClick={alEmpezar} className={BOTON}>
        Empezar
      </button>
    </section>
  );
}

/** Una tarea de escrita: el enunciado a un lado y el folio al otro. En el móvil,
 *  uno debajo del otro — un folio a media pantalla no es un folio. */
function TareaDeEscrita({
  tarea, borrador, bloqueado, alEscribir, alElegir,
}: {
  tarea: TareaParaHacer;
  borrador: Borrador;
  bloqueado: boolean;
  alEscribir?: (texto: string) => void;
  alElegir?: (opcion: number) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <EnunciadoDeEscrita
        formulario={tarea.formulario}
        opcionElegida={borrador.opcion}
        alElegir={alElegir}
        bloqueado={bloqueado}
      />
      <Folio
        texto={borrador.texto}
        rango={rangoDe(tarea)}
        bloqueado={bloqueado}
        alEscribir={alEscribir ?? (() => {})}
      />
    </div>
  );
}

/**
 * La pregunta de antes de entregar. Va en la pantalla y no en un `confirm` del
 * navegador: en el móvil ese cartel sale sin decir qué falta y con dos botones
 * del sistema, y aquí hace falta leer una lista.
 *
 * Pieza aparte y exportada para poder pintarla sin tocar nada: es la única
 * forma de probar lo que dice, porque dentro de la pantalla solo aparece
 * después de un clic y aquí no hay jsdom.
 */
export function PreguntaDeEntrega({
  falta, enviando, alSi, alNo,
}: {
  falta: string[];
  enviando: boolean;
  alSi: () => void;
  alNo: () => void;
}) {
  return (
    <section className={CAJA}>
      {falta.length > 0 ? (
        <p>Ojo: {enLista(falta)}. ¿Entregar de todas formas?</p>
      ) : (
        <p>Entregar no se puede deshacer. ¿Entregar?</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={enviando} onClick={alSi} className={BOTON}>
          Sí, entregar
        </button>
        <button type="button" disabled={enviando} onClick={alNo} className={BOTON_SUAVE}>
          Seguir escribiendo
        </button>
      </div>
    </section>
  );
}

/**
 * A medias: el reloj, las pestañas de las dos tareas, y el folio abierto con su
 * enunciado al lado. Lo que se escribe viaja solo al servidor (`useBorradores`);
 * «Entregar» pregunta antes, y dice lo que falta.
 */
function EscritaHaciendo({ prueba }: { prueba: PruebaParaHacer }) {
  const router = useRouter();
  const examenId = prueba.examen.id;
  // El reloj es del examen de verdad. En libre no hay ninguno que enseñar.
  const conReloj = prueba.modo === "COMPLETO" && prueba.minutos !== null;
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [bloqueadaPorError, setBloqueadaPorError] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [procesando, empezarTransicion] = useTransition();
  // Una sola entrega automática. Lo que defiende la bandera no es la identidad
  // de `alAcabarse` (de eso se defiende el propio <Reloj>, que se la guarda en
  // una ref): es que el aviso del reloj puede llegar MÁS DE UNA VEZ. `<Reloj>`
  // rearma su aviso cada vez que el servidor manda una cuenta nueva, y aquí se
  // refresca la pantalla al entregar: si el refresco vuelve a caer en esta cara
  // con la cuenta ya en cero, el reloj avisaría otra vez y entregaríamos dos
  // veces. Con la bandera, la segunda llamada no sale de aquí.
  const entregadaPorTiempo = useRef(false);

  const { borradores, abierto, estado, escribir, elegir, guardar, guardarYAvisar } = useBorradores(
    prueba,
    tareaAbierta,
    // Lo que el servidor rechace mientras se escribe: se enseña siempre, y solo
    // apaga los folios si es el del tiempo (ver `apagaLosFolios`), que es
    // además el caso en que el refresco lleva a la cara de entregada. Con
    // cualquier otro el folio sigue vivo: son rechazos de ESTE guardado, no el
    // fin de la prueba, y es tecleando como se arreglan. Y no es un pestillo:
    // si el siguiente guardado va bien y luego falla el del tiempo, se apaga
    // igual.
    (mensaje: string) => {
      setError(mensaje);
      setBloqueadaPorError(apagaLosFolios(mensaje));
      router.refresh();
    },
  );

  function alCambiarDeTarea(numero: number) {
    if (numero === tareaAbierta) return;
    // Lo que se deja atrás se manda ya, sin esperar los dos segundos: el
    // temporizador de la tarea vieja se limpia en cuanto cambie la pestaña.
    guardarYAvisar(tareaAbierta);
    setTareaAbierta(numero);
  }

  const alAcabarse = useCallback(() => {
    if (entregadaPorTiempo.current) return;
    entregadaPorTiempo.current = true;
    empezarTransicion(async () => {
      // El último borrador, antes de nada: el servidor da unos segundos de
      // gracia, y en esos segundos cabe lo que se escribió tras el último
      // guardado. Si ya no lo acepta, da igual: se entrega igualmente, porque
      // aquí el tiempo ya se acabó y no hay nada que reintentar.
      await guardar(tareaAbierta);
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      // Se refresca también con error, como en PruebaHaciendo: los errores que
      // llegan aquí significan que la prueba YA está cerrada por el servidor.
      if (r.error) setError(r.error);
      router.refresh();
    });
  }, [examenId, prueba.prueba, guardar, tareaAbierta, router]);

  function alEntregar() {
    empezarTransicion(async () => {
      // Lo último escrito, antes de entregar. Y si el servidor no lo acepta NO
      // se entrega: a diferencia de la entrega por reloj, aquí no hay ninguna
      // prisa, y entregar sin el último párrafo —por un corte de red de un
      // segundo— es perder trabajo sin decirlo. Se enseña el fallo, se cierra la
      // pregunta y el botón vuelve a estar ahí para intentarlo otra vez.
      const fallo = await guardar(tareaAbierta);
      if (fallo) {
        setError(fallo);
        setConfirmando(false);
        return;
      }
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  const cartel = TEXTO_DEL_GUARDADO[estado];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {conReloj && prueba.segundosQueQuedan !== null && (
          <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} />
        )}
        {/* El cartelito del guardado, al lado del reloj: es lo que le dice al
            chico si puede irse tranquilo. Callado hasta que toca algo. */}
        {cartel && <span className="text-sm text-tinta-suave">{cartel}</span>}
      </div>
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={alCambiarDeTarea} />
      {tarea && (
        <TareaDeEscrita
          tarea={tarea}
          borrador={abierto}
          bloqueado={bloqueadaPorError}
          alEscribir={(texto) => escribir(tareaAbierta, texto)}
          alElegir={(opcion) => elegir(tareaAbierta, opcion)}
        />
      )}
      {confirmando ? (
        <PreguntaDeEntrega
          falta={loQueFalta(prueba, borradores)}
          enviando={procesando}
          alSi={alEntregar}
          alNo={() => setConfirmando(false)}
        />
      ) : (
        // Sin `bloqueadaPorError`, igual que en la lectura: un fallo al guardar
        // apaga los folios, no la salida.
        <button type="button" disabled={procesando} onClick={() => setConfirmando(true)} className={BOTON}>
          Entregar
        </button>
      )}
    </div>
  );
}

/**
 * Entregada y todavía sin firmar. Las dos tareas seguidas y no en pestañas: son
 * dos, ya no hay nada que hacer con ellas, y esconder media entrega detrás de
 * una pestaña solo invita a pensar que se ha perdido.
 */
function EscritaEsperando({ prueba }: { prueba: PruebaParaHacer }) {
  return (
    <div className="flex flex-col gap-6">
      <section className={CAJA}>
        <p className="text-tinta-suave">
          {NOMBRE_DE_PRUEBA[prueba.prueba]} · {prueba.examen.titulo}
        </p>
        <p className="text-2xl font-extrabold">Entregada. Esperando corrección</p>
        {/* La fecha no es adorno: es el acuse de recibo. Quien lleva tres días
            viendo «esperando corrección» sin fecha no sabe si su redacción
            llegó o si se perdió por el camino. */}
        {prueba.entregadaEn && <p>La mandaste el {fechaHoraEnPalabras(prueba.entregadaEn)}.</p>}
        {prueba.estado.porTiempo && <p className="text-tinta-suave">Se entregó sola: se acabó el tiempo.</p>}
        <p>
          La corrige tu profesor, a mano: no hay nota automática. Cuando la firme, verás aquí las cuatro notas de cada
          tarea y lo que te diga.
        </p>
      </section>
      {prueba.tareas.map((t) => (
        <section key={t.numero} className={CAJA}>
          <h2 className="font-bold">Tarea {t.numero}</h2>
          <TareaDeEscrita
            tarea={t}
            borrador={{ texto: escritoDe(prueba, t.numero)?.texto ?? "", opcion: escritoDe(prueba, t.numero)?.opcion ?? null }}
            bloqueado
          />
        </section>
      ))}
    </div>
  );
}

/** Las cuatro bandas de una tarea, con su criterio. La `ayuda` está vacía hasta
 *  que el profesor la dicte, y vacía no se pinta. */
function BandasDeLaTarea({ bandas }: { bandas: number[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {CRITERIOS_EE.map((criterio, i) => (
        <li key={criterio.clave} className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col">
            <span>{criterio.nombre}</span>
            {criterio.ayuda !== "" && (
              <span data-ayuda className="text-sm text-tinta-suave">{criterio.ayuda}</span>
            )}
          </span>
          <span className="font-bold whitespace-nowrap">
            {bandas[i] ?? 0} de {BANDA_MAXIMA}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Firmada: la suma arriba y, por tarea, lo que escribió con sus bandas y el
 *  comentario del profesor al lado. */
function EscritaCorregida({ prueba }: { prueba: PruebaParaHacer }) {
  return (
    <div className="flex flex-col gap-6">
      <section className={CAJA}>
        <p className="text-tinta-suave">
          {NOMBRE_DE_PRUEBA[prueba.prueba]} · {prueba.examen.titulo}
        </p>
        <p className="text-3xl font-extrabold">
          {prueba.estado.aciertos} de {prueba.estado.total}
        </p>
        {prueba.corregidaEn && (
          <p className="text-tinta-suave">Corregida el {fechaHoraEnPalabras(prueba.corregidaEn)}.</p>
        )}
        {prueba.estado.porTiempo && <p className="text-tinta-suave">Se entregó sola: se acabó el tiempo.</p>}
        <p className="text-tinta-suave">
          Cada tarea se mira con cuatro criterios, de 0 a {BANDA_MAXIMA} cada uno.
        </p>
      </section>
      {prueba.tareas.map((t) => {
        const escrito = escritoDe(prueba, t.numero);
        return (
          <section key={t.numero} className={CAJA}>
            <h2 className="font-bold">Tarea {t.numero}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <p className="min-w-0 rounded-2xl border border-tinta-suave/20 bg-tinta-suave/5 p-4 whitespace-pre-line">
                {escrito?.texto ?? ""}
              </p>
              {/* Sin `correccion` no se pinta banda ninguna: la fila puede estar
                  sin bandas si el profesor firmó el resto y no esta tarea. */}
              {escrito?.correccion ? (
                <div className="flex min-w-0 flex-col gap-3">
                  <BandasDeLaTarea bandas={escrito.correccion.bandas} />
                  {escrito.correccion.comentario !== "" && (
                    <p className="rounded-2xl bg-hp-50 p-4 whitespace-pre-line">{escrito.correccion.comentario}</p>
                  )}
                </div>
              ) : (
                <p className="text-tinta-suave">Esta tarea todavía no tiene notas.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * El armazón de la escrita: las mismas cuatro caras que la lectura, pero con
 * folios en vez de letras. Lleva su propio <VolverAInicio> porque el
 * encaminado de HacerPrueba manda aquí ANTES de llegar al suyo: sin esto, la
 * escrita nacería con el mismo callejón sin salida que ya costó una ronda en
 * la lectura.
 *
 * `modo` NO añade una quinta cara. La escrita es la única prueba que en
 * práctica libre crea intento y se entrega de verdad (spec §9): las mismas
 * cuatro caras del examen completo sirven igual, sin reloj —eso lo deciden
 * `AvisoDeLaEscrita` y `EscritaHaciendo` mirando `prueba.modo`, no el
 * encaminado de aquí—. Una cara aparte que dijera «no se guarda» estaría
 * mintiendo: en libre la escrita se guarda y se manda igual que en un examen
 * de verdad.
 */
export function HacerEscrita({ prueba }: { prueba: PruebaParaHacer }) {
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

  const cara =
    prueba.estado.estado === "SIN_EMPEZAR" ? <AvisoDeLaEscrita prueba={prueba} alEmpezar={alEmpezar} enviando={procesando} error={error} />
    : !estaEntregada(prueba.estado) ? <EscritaHaciendo prueba={prueba} />
    : estaCorregida(prueba) ? <EscritaCorregida prueba={prueba} />
    : <EscritaEsperando prueba={prueba} />;

  return (
    <div className="flex flex-col gap-4">
      {/* El reloj solo corre en un examen de verdad ya empezado: en la práctica
          libre hay minutos en la ficha, pero nadie los cuenta. */}
      <VolverAInicio
        haciendoConReloj={prueba.modo !== "LIBRE" && prueba.estado.estado === "HACIENDO" && prueba.minutos !== null}
      />
      {cara}
    </div>
  );
}
