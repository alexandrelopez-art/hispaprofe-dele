"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EscritoParaHacer, PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { BANDA_MAXIMA, CRITERIOS_EE, NOMBRE_DE_PRUEBA } from "@/lib/dele/estructura";
import { estaEntregada } from "@/lib/examen/motor";
import { empezarPruebaAccion, entregarPruebaAccion, guardarEscritoAccion } from "@/app/examen/acciones";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import { Folio, type Rango } from "@/components/examen/folio";
// Del fichero hermano: las pestañas y la salida a Inicio son las mismas de la
// lectura y de la auditiva, y tienen que seguir siéndolo. Sí, hacer-prueba.tsx
// importa a su vez `HacerEscrita` de aquí: el círculo es a propósito y no
// muerde, porque ninguno de los dos lee nada del otro mientras se cargan los
// módulos — solo al pintar, que es mucho después.
import { AVISO_DE_ERROR, BOTON, CAJA, PestanasDeTarea, VolverAInicio } from "@/components/examen/hacer-prueba";
import { Reloj } from "@/components/examen/reloj";

/** Lo que el estudiante lleva escrito en UNA tarea: su folio y, si la tarea
 *  tiene opciones, sobre cuál escribe. */
export type Borrador = { texto: string; opcion: number | null };

const BORRADOR_VACIO: Borrador = { texto: "", opcion: null };

const BOTON_SUAVE = "self-start rounded-2xl border border-tinta-suave/30 px-6 py-3 font-bold disabled:opacity-50";

/** Los dos segundos de calma antes de mandar el borrador al servidor. */
const CALMA = 2000;

/** Nada que mandar si no ha cambiado nada desde el último guardado. */
export function hayQueGuardar(guardado: Borrador, actual: Borrador): boolean {
  return guardado.texto !== actual.texto || guardado.opcion !== actual.opcion;
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

/** Cuántas palabras piden en esta tarea. Solo las redacciones lo dicen. */
function rangoDe(tarea: TareaParaHacer): Rango {
  const f = tarea.formulario;
  if (f.forma === "REDACCION_UNA" || f.forma === "REDACCION_DOS") return f.actividad.palabras;
  return { min: null, max: null };
}

const escritoDe = (prueba: PruebaParaHacer, tarea: number): EscritoParaHacer | undefined =>
  prueba.escritos.find((e) => e.tarea === tarea);

/**
 * Corregida de verdad: el profesor FIRMÓ (`corregidaEn`) y la nota está puesta.
 * No basta con que esté entregada — la escrita pasa días en ESPERANDO —, y
 * tampoco basta la firma sola: sin `aciertos`, la cabecera diría «null de 24».
 */
function estaCorregida(prueba: PruebaParaHacer): boolean {
  return prueba.corregidaEn !== null && prueba.estado.aciertos !== null;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" });

/**
 * El aviso previo de la escrita. Dice las dos cosas que la separan de la
 * lectura: que el reloj la entrega sola (eso lo comparten) y que la nota no
 * sale al entregar, porque la pone una persona. Un chico que entrega y no ve
 * nota se cree que algo se ha roto: por eso se avisa ANTES.
 */
function AvisoDeLaEscrita({
  prueba, alEmpezar, enviando, error,
}: {
  prueba: PruebaParaHacer;
  alEmpezar: () => void;
  enviando: boolean;
  error: string | null;
}) {
  return (
    <section className={CAJA}>
      <h1 className="text-xl font-bold">
        {prueba.examen.titulo} · {NOMBRE_DE_PRUEBA[prueba.prueba]}
      </h1>
      <p>Tienes {prueba.minutos} minutos. Cuando se acaben, la prueba se entrega ella sola: no se puede repetir.</p>
      <p>Lo que escribas se guarda solo mientras escribes. La nota no sale al entregar: la pone tu profesor.</p>
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
 * A medias: el reloj, las pestañas de las dos tareas, y el folio abierto con su
 * enunciado al lado. Lo que se escribe viaja solo al servidor; «Entregar»
 * pregunta antes, y dice lo que falta.
 */
function EscritaHaciendo({ prueba }: { prueba: PruebaParaHacer }) {
  const router = useRouter();
  const examenId = prueba.examen.id;
  const [borradores, setBorradores] = useState<Record<number, Borrador>>(() => borradoresDe(prueba));
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [bloqueadaPorError, setBloqueadaPorError] = useState(false);
  const [guardado, setGuardado] = useState<"nada" | "guardando" | "hecho">("nada");
  const [confirmando, setConfirmando] = useState(false);
  const [procesando, empezarTransicion] = useTransition();
  // Lo que el servidor YA tiene, tarea por tarea. En una ref y no en estado: no
  // se pinta, y si fuera estado cada guardado provocaría otro render y con él
  // otro temporizador.
  const guardadoEnServidor = useRef<Record<number, Borrador>>(borradoresDe(prueba));
  // Una sola entrega automática, igual que en PruebaHaciendo: sin esto, cada
  // re-render (uno por cada guardado en curso) le pasa a <Reloj> una
  // `alAcabarse` con identidad nueva, su efecto se re-dispara con la cuenta ya
  // en cero, y entregarPruebaAccion se llamaría una y otra vez.
  const entregadaPorTiempo = useRef(false);

  /**
   * Manda el borrador de una tarea, y solo si ha cambiado. Devuelve el error
   * si lo hubo, para que quien llama decida: el temporizador y el cambio de
   * pestaña lo enseñan y apagan los folios; la entrega automática lo deja
   * pasar, porque va a entregar de todas formas.
   */
  const guardar = useCallback(async (tarea: number, b: Borrador): Promise<string | null> => {
    const yaEstaba = guardadoEnServidor.current[tarea] ?? BORRADOR_VACIO;
    if (!hayQueGuardar(yaEstaba, b)) return null;
    // Se apunta ANTES de la vuelta del servidor: mientras esta llamada está en
    // el aire, otra tecla puede armar un segundo temporizador, y sin esto las
    // dos mandarían lo mismo. Si falla, se deshace.
    guardadoEnServidor.current = { ...guardadoEnServidor.current, [tarea]: b };
    setGuardado("guardando");
    const r = await guardarEscritoAccion(examenId, tarea, b.texto, b.opcion);
    if (r.error) {
      guardadoEnServidor.current = { ...guardadoEnServidor.current, [tarea]: yaEstaba };
      setGuardado("nada");
      return r.error;
    }
    setGuardado("hecho");
    return null;
  }, [examenId]);

  /**
   * El guardado de siempre: si el servidor dice que no —«Se acabó el tiempo.»
   * es el caso de verdad—, se enseña, se apagan los folios y se refresca. El
   * refresco es lo que lleva a la cara de entregada: seguir escribiendo en una
   * prueba que el servidor ya cerró sería escribir en el aire.
   */
  const guardarYAvisar = useCallback((tarea: number, b: Borrador) => {
    empezarTransicion(async () => {
      const fallo = await guardar(tarea, b);
      if (!fallo) return;
      setError(fallo);
      setBloqueadaPorError(true);
      router.refresh();
    });
  }, [guardar, router]);

  const borradorAbierto = borradores[tareaAbierta] ?? BORRADOR_VACIO;
  const { texto: textoAbierto, opcion: opcionAbierta } = borradorAbierto;

  // El borrador viaja al servidor dos segundos después de dejar de teclear, al
  // cambiar de pestaña y antes de entregar. No en cada tecla: serían cientos de
  // escrituras por redacción. El temporizador se limpia al desmontar.
  //
  // Las dependencias son el texto y la opción sueltos, no el objeto borrador:
  // el objeto se construye en cada render y el temporizador volvería a empezar
  // de cero cada vez que la pantalla se repintara por cualquier otra cosa.
  useEffect(() => {
    const actual = { texto: textoAbierto, opcion: opcionAbierta };
    if (!hayQueGuardar(guardadoEnServidor.current[tareaAbierta] ?? BORRADOR_VACIO, actual)) return;
    const t = setTimeout(() => { guardarYAvisar(tareaAbierta, actual); }, CALMA);
    return () => clearTimeout(t);
  }, [textoAbierto, opcionAbierta, tareaAbierta, guardarYAvisar]);

  function alEscribir(texto: string) {
    setBorradores((b) => ({ ...b, [tareaAbierta]: conTexto(b[tareaAbierta] ?? BORRADOR_VACIO, texto) }));
  }

  function alElegirOpcion(opcion: number) {
    // conOpcion, y no un borrador nuevo: cambiar de tema NO borra el folio.
    setBorradores((b) => ({ ...b, [tareaAbierta]: conOpcion(b[tareaAbierta] ?? BORRADOR_VACIO, opcion) }));
  }

  function alCambiarDeTarea(numero: number) {
    if (numero === tareaAbierta) return;
    // Lo que se deja atrás se manda ya, sin esperar los dos segundos: el
    // temporizador de la tarea vieja se va a limpiar en cuanto cambie la
    // pestaña, y lo escrito en los últimos segundos se quedaría sin mandar.
    guardarYAvisar(tareaAbierta, borradorAbierto);
    setTareaAbierta(numero);
  }

  const alAcabarse = useCallback(() => {
    if (entregadaPorTiempo.current) return;
    entregadaPorTiempo.current = true;
    empezarTransicion(async () => {
      // El último borrador, antes de nada: el servidor da unos segundos de
      // gracia, y en esos segundos cabe lo que se escribió tras el último
      // guardado. Si ya no lo acepta, da igual: se entrega igualmente.
      await guardar(tareaAbierta, borradores[tareaAbierta] ?? BORRADOR_VACIO);
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      // Se refresca también con error, como en PruebaHaciendo: los errores que
      // llegan aquí significan que la prueba YA está cerrada por el servidor.
      if (r.error) setError(r.error);
      router.refresh();
    });
  }, [examenId, prueba.prueba, guardar, borradores, tareaAbierta, router]);

  function alEntregar() {
    empezarTransicion(async () => {
      await guardar(tareaAbierta, borradorAbierto);
      const r = await entregarPruebaAccion(examenId, prueba.prueba);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  const falta = loQueFalta(prueba, borradores);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {prueba.minutos !== null && prueba.segundosQueQuedan !== null && (
          <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} />
        )}
        {/* El cartelito del guardado, al lado del reloj: es lo que le dice al
            chico que puede irse tranquilo. Callado hasta el primer guardado. */}
        {guardado !== "nada" && (
          <span className="text-sm text-tinta-suave">{guardado === "guardando" ? "Guardando…" : "Guardado"}</span>
        )}
      </div>
      {error && <p role="alert" className={AVISO_DE_ERROR}>{error}</p>}
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={alCambiarDeTarea} />
      {tarea && (
        <TareaDeEscrita
          tarea={tarea}
          borrador={borradorAbierto}
          bloqueado={bloqueadaPorError}
          alEscribir={alEscribir}
          alElegir={alElegirOpcion}
        />
      )}
      {/* La pregunta va en la pantalla y no en un `confirm` del navegador: en el
          móvil ese cartel sale sin decir qué falta y con dos botones del
          sistema, y aquí hace falta leer una lista. */}
      {confirmando ? (
        <section className={CAJA}>
          {falta.length > 0 ? (
            <p>Te falta {falta.join(" y ")}. ¿Entregar de todas formas?</p>
          ) : (
            <p>Entregar no se puede deshacer. ¿Entregar?</p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={procesando} onClick={alEntregar} className={BOTON}>
              Sí, entregar
            </button>
            <button type="button" disabled={procesando} onClick={() => setConfirmando(false)} className={BOTON_SUAVE}>
              Seguir escribiendo
            </button>
          </div>
        </section>
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
          <p className="text-tinta-suave">Corregida el {FECHA_LARGA.format(prueba.corregidaEn)}.</p>
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
 * Práctica libre: se escribe para practicar y ya está. No hay reloj ni entrega
 * —no hay intento que abrir ni que cerrar— y tampoco se guarda nada: el
 * borrador vive en el navegador, porque `guardarEscrito` exige una prueba
 * empezada y en libre no la hay. Se dice, que es lo que no se puede callar.
 */
function EscritaLibre({ prueba }: { prueba: PruebaParaHacer }) {
  const [borradores, setBorradores] = useState<Record<number, Borrador>>(() => borradoresDe(prueba));
  const [tareaAbierta, setTareaAbierta] = useState(prueba.tareas[0]?.numero ?? 1);
  const tarea = prueba.tareas.find((t) => t.numero === tareaAbierta) ?? prueba.tareas[0];
  const borrador = borradores[tareaAbierta] ?? BORRADOR_VACIO;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-tinta-suave">
        Práctica libre: escribe todo lo que quieras. Esto no se guarda ni lo corrige nadie — la escrita la corrige tu
        profesor cuando la haces en un examen asignado.
      </p>
      <PestanasDeTarea tareas={prueba.tareas} abierta={tareaAbierta} alElegir={setTareaAbierta} />
      {tarea && (
        <TareaDeEscrita
          tarea={tarea}
          borrador={borrador}
          bloqueado={false}
          alEscribir={(texto) => setBorradores((b) => ({ ...b, [tareaAbierta]: conTexto(b[tareaAbierta] ?? BORRADOR_VACIO, texto) }))}
          alElegir={(opcion) => setBorradores((b) => ({ ...b, [tareaAbierta]: conOpcion(b[tareaAbierta] ?? BORRADOR_VACIO, opcion) }))}
        />
      )}
    </div>
  );
}

/**
 * El armazón de la escrita: las mismas cuatro caras que la lectura, pero con
 * folios en vez de letras. Lleva su propio <VolverAInicio> porque el
 * encaminado de HacerPrueba manda aquí ANTES de llegar al suyo: sin esto, la
 * escrita nacería con el mismo callejón sin salida que ya costó una ronda en
 * la lectura.
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
    prueba.modo === "LIBRE" ? <EscritaLibre prueba={prueba} />
    : prueba.estado.estado === "SIN_EMPEZAR" ? <AvisoDeLaEscrita prueba={prueba} alEmpezar={alEmpezar} enviando={procesando} error={error} />
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
