"use client";

import { useState } from "react";
import { Desplegable } from "@/components/ui/desplegable";
import type { ReglaTarea } from "@/lib/dele/estructura";
import type { TareaParaHacer } from "@/lib/examen/paraHacer";
import { letrasPosibles } from "@/lib/taller/estado";
import type { Formulario, FormularioDe } from "@/lib/taller/formas";

type Marcadas = Record<string, string>;

/** Un texto suelto, fuera de la actividad: cada uno con su etiqueta. */
function TextoSuelto({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  return (
    <section className={CAJA}>
      {etiqueta && <h3 className="font-bold">{etiqueta}</h3>}
      <p className="whitespace-pre-wrap">{texto}</p>
    </section>
  );
}

const CAJA = "flex min-w-0 flex-col gap-3 rounded-tarjeta bg-white p-4 shadow-suave";

/** La caja de una pregunta: coral y con `data-fallo` si el estudiante la falló. */
function cajaPregunta(fallo: boolean): string {
  return `flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 ${fallo ? "border-coral-500 bg-coral-100/40" : "border-tinta-suave/20"}`;
}

function esFallo(numero: number, fallos: number[] | null): boolean {
  return fallos?.includes(numero) ?? false;
}

/**
 * Lo que el estudiante CONSULTA en relacionar: el ejemplo y los diez destinos.
 * Va aparte de las preguntas porque son dos cosas que hay que mirar a la vez —
 * en papel son dos páginas abiertas— y si van una detrás de otra, se lee todo,
 * se baja a contestar y ya no se ve lo que se acaba de leer. Lo dijo el
 * profesor viendo hacer la tarea 1.
 */
function ReferenciaRelacionar({ f, regla }: { f: FormularioDe<"RELACIONAR">; regla: ReglaTarea }) {
  const a = f.actividad;
  const conTexto = Boolean(regla.elementosConTexto);
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Ejemplo (0)</h3>
        {conTexto && <p className="whitespace-pre-wrap">{a.ejemplo.texto}</p>}
        <p>
          Ya resuelto: <strong>{a.ejemplo.letra}</strong>
        </p>
      </section>
      {a.destinos.map((d) => (
        <section key={d.letra} className={CAJA}>
          <h3 className="font-bold">
            {d.letra}
            {d.titulo ? `. ${d.titulo}` : ""}
          </h3>
          <p className="whitespace-pre-wrap">{d.texto}</p>
        </section>
      ))}
    </>
  );
}

function PreguntasRelacionar({
  f, regla, marcadas, fallos, bloqueada, alMarcar,
}: {
  f: FormularioDe<"RELACIONAR">;
  regla: ReglaTarea;
  marcadas: Marcadas;
  fallos: number[] | null;
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const a = f.actividad;
  const conTexto = Boolean(regla.elementosConTexto);
  return (
    <>
      {a.elementos.map((e) => {
        const fallo = esFallo(e.numero, fallos);
        return (
          <section key={e.numero} data-pregunta={e.numero} data-fallo={fallo ? e.numero : undefined} className={cajaPregunta(fallo)}>
            <h3 className="font-bold">Pregunta {e.numero}</h3>
            {conTexto && <p className="whitespace-pre-wrap">{e.texto}</p>}
            <select
              aria-label={`Pregunta ${e.numero}`}
              value={marcadas[String(e.numero)] ?? ""}
              disabled={bloqueada}
              onChange={(ev) => alMarcar(e.numero, ev.target.value)}
              className="w-full rounded-xl border border-tinta-suave/30 p-3"
            >
              <option value="" disabled>
                Elige una letra
              </option>
              {letrasPosibles(f, e.numero).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </section>
        );
      })}
    </>
  );
}

/** Lo que se consulta en lista común: las tres personas y el ejemplo. Misma razón que en relacionar. */
function ReferenciaListaComun({ f }: { f: FormularioDe<"LISTA_COMUN"> }) {
  const a = f.actividad;
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Lista común</h3>
        <ul className="flex flex-col gap-1">
          {a.comunes.map((c) => (
            <li key={c.letra}>
              {c.letra}. {c.texto}
            </li>
          ))}
        </ul>
      </section>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <p>{a.ejemplo.enunciado}</p>
          <p>
            Ya resuelto: <strong>{a.ejemplo.letra}</strong>
          </p>
        </section>
      )}
    </>
  );
}

function PreguntasListaComun({
  f, marcadas, fallos, bloqueada, alMarcar,
}: {
  f: FormularioDe<"LISTA_COMUN">;
  marcadas: Marcadas;
  fallos: number[] | null;
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const a = f.actividad;
  return (
    <>
      {a.preguntas.map((p) => {
        const fallo = esFallo(p.numero, fallos);
        return (
          <section key={p.numero} data-pregunta={p.numero} data-fallo={fallo ? p.numero : undefined} className={cajaPregunta(fallo)}>
            <h3 className="font-bold">Pregunta {p.numero}</h3>
            <p>{p.enunciado}</p>
            <div className="flex flex-wrap gap-4">
              {a.comunes.map((c) => (
                <label key={c.letra} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`pregunta-${p.numero}`}
                    value={c.letra}
                    checked={marcadas[String(p.numero)] === c.letra}
                    disabled={bloqueada}
                    onChange={() => alMarcar(p.numero, c.letra)}
                  />
                  {c.letra}
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function OpcionRadio({
  letra, texto, conImagen, ficheroId, nombre, seleccionada, disabled, onChange,
}: {
  letra: string;
  texto: string;
  conImagen: boolean;
  ficheroId: string | undefined;
  nombre: string;
  seleccionada: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const borde = seleccionada ? "border-tinta bg-fondo" : "border-tinta-suave/30";
  // Con foto, la foto manda: ocupa la caja entera y la letra va debajo, al lado
  // del botón. Antes iba en una fila de ancho completo con la foto pequeña a un
  // lado, y quedaban tres cintas alargadas y casi vacías: en esta tarea la
  // respuesta ES la foto, así que tiene que ser lo que se ve.
  if (conImagen) {
    return (
      <label className={`flex min-w-0 cursor-pointer flex-col gap-1 rounded-xl border p-1 focus-within:outline-2 focus-within:outline-hp-600 sm:gap-2 sm:p-2 ${borde}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de vida corta */}
        <img src={`/api/ficheros/${ficheroId}`} alt={`Opción ${letra}`} className="aspect-4/3 w-full max-w-full rounded-lg object-contain" />
        <span className="flex items-center gap-2 font-bold">
          <input type="radio" name={nombre} value={letra} checked={seleccionada} disabled={disabled} onChange={onChange} className="accent-tinta" />
          {letra}
        </span>
      </label>
    );
  }
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 focus-within:outline-2 focus-within:outline-hp-600 ${borde}`}>
      <input type="radio" name={nombre} value={letra} checked={seleccionada} disabled={disabled} onChange={onChange} className="accent-tinta" />
      <span>
        {letra}. {texto}
      </span>
    </label>
  );
}

/**
 * Cómo se reparten las opciones de una pregunta: las de foto, una al lado de
 * otra (caben tres en una fila incluso en un móvil estrecho, y así se comparan
 * de un vistazo, que es lo que pide la tarea); las de texto, una debajo de otra.
 */
function filaDeOpciones(conImagen: boolean): string {
  return conImagen ? "grid grid-cols-3 gap-1 sm:gap-2" : "flex flex-col gap-2";
}

function ActividadOpciones({
  f, marcadas, fallos, bloqueada, alMarcar,
}: {
  f: FormularioDe<"OPCIONES">;
  marcadas: Marcadas;
  fallos: number[] | null;
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const a = f.actividad;
  return (
    <>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <p>{a.ejemplo.enunciado}</p>
          <div className={filaDeOpciones(a.ejemplo.opciones.some((o) => o.conImagen))}>
            {a.ejemplo.opciones.map((o) => (
              <OpcionRadio
                key={o.letra}
                letra={o.letra}
                texto={o.texto}
                conImagen={o.conImagen}
                ficheroId={f.medios.imagenes[`ejemplo-${o.letra}`]}
                nombre="ejemplo"
                seleccionada={o.letra === a.ejemplo!.letra}
                disabled
                onChange={() => {}}
              />
            ))}
          </div>
        </section>
      )}
      {a.preguntas.map((p, i) => {
        const fallo = esFallo(p.numero, fallos);
        return (
          <section key={p.numero} data-pregunta={p.numero} data-fallo={fallo ? p.numero : undefined} className={cajaPregunta(fallo)}>
            {p.grupo !== null && (i === 0 || a.preguntas[i - 1].grupo !== p.grupo) && (
              <p className="text-sm font-bold uppercase text-tinta-suave">Noticia {p.grupo}</p>
            )}
            <h3 className="font-bold">Pregunta {p.numero}</h3>
            <p>{p.enunciado}</p>
            <div className={filaDeOpciones(p.opciones.some((o) => o.conImagen))}>
              {p.opciones.map((o) => (
                <OpcionRadio
                  key={o.letra}
                  letra={o.letra}
                  texto={o.texto}
                  conImagen={o.conImagen}
                  ficheroId={f.medios.imagenes[`${p.numero}-${o.letra}`]}
                  nombre={`pregunta-${p.numero}`}
                  seleccionada={marcadas[String(p.numero)] === o.letra}
                  disabled={bloqueada}
                  onChange={() => alMarcar(p.numero, o.letra)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ActividadHuecos({
  f, marcadas, fallos, bloqueada, alMarcar,
}: {
  f: FormularioDe<"HUECOS">;
  marcadas: Marcadas;
  fallos: number[] | null;
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const a = f.actividad;
  return (
    <>
      {a.huecos.map((h) => {
        const fallo = esFallo(h.numero, fallos);
        return (
          <section key={h.numero} data-pregunta={h.numero} data-fallo={fallo ? h.numero : undefined} className={cajaPregunta(fallo)}>
            <h3 className="font-bold">Hueco {h.numero}</h3>
            <div className="flex flex-col gap-2">
              {h.opciones.map((o) => (
                <label key={o.letra} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`pregunta-${h.numero}`}
                    value={o.letra}
                    checked={marcadas[String(h.numero)] === o.letra}
                    disabled={bloqueada}
                    onChange={() => alMarcar(h.numero, o.letra)}
                  />
                  {o.letra}. {o.texto}
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/** El texto largo de HUECOS: título, texto con los huecos marcados y fuente. */
function TextoHuecos({ f }: { f: FormularioDe<"HUECOS"> }) {
  const a = f.actividad;
  return (
    <section className={CAJA}>
      {a.titulo && <h3 className="font-bold">{a.titulo}</h3>}
      <p className="whitespace-pre-wrap">{a.texto}</p>
      {a.fuente && <p className="text-sm text-tinta-suave">{a.fuente}</p>}
    </section>
  );
}

/**
 * Las dos mitades de una actividad: lo que se CONSULTA y lo que se CONTESTA.
 * Separarlas es lo que deja poner el material a un lado y las preguntas al
 * otro. En opciones y huecos no hay material propio de la actividad (el texto
 * largo va suelto, en `f.textos`), así que la mitad de consulta va vacía.
 */
function partesDe(
  f: Formulario,
  regla: ReglaTarea,
  marcadas: Marcadas,
  fallos: number[] | null,
  bloqueada: boolean,
  alMarcar: (numero: number, letra: string) => void,
): { referencia: React.ReactNode; preguntas: React.ReactNode } {
  switch (f.forma) {
    case "RELACIONAR":
      return {
        referencia: <ReferenciaRelacionar f={f} regla={regla} />,
        preguntas: <PreguntasRelacionar f={f} regla={regla} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />,
      };
    case "LISTA_COMUN":
      return {
        referencia: <ReferenciaListaComun f={f} />,
        preguntas: <PreguntasListaComun f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />,
      };
    case "OPCIONES":
      return { referencia: null, preguntas: <ActividadOpciones f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} /> };
    case "HUECOS":
      return { referencia: null, preguntas: <ActividadHuecos f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} /> };
    default:
      return { referencia: null, preguntas: null };
  }
}

/** Las preguntas de una tarea, reducidas a lo que la barra necesita: número, enunciado y letras entre las que elegir. */
type PreguntaDeLaBarra = { numero: number; texto: string; letras: string[] };

function preguntasParaLaBarra(f: Formulario): PreguntaDeLaBarra[] {
  switch (f.forma) {
    case "RELACIONAR":
      return f.actividad.elementos.map((e) => ({ numero: e.numero, texto: e.texto, letras: letrasPosibles(f, e.numero) }));
    case "LISTA_COMUN":
      return f.actividad.preguntas.map((p) => ({ numero: p.numero, texto: p.enunciado, letras: f.actividad.comunes.map((c) => c.letra) }));
    default:
      return [];
  }
}

/**
 * La barra que viaja con el estudiante, SOLO en pantalla estrecha (`md:hidden`).
 * En ordenador no hace falta: ahí las preguntas están siempre a la vista, en su
 * columna. En un móvil no caben dos columnas, así que el material se lee de
 * corrido y las respuestas van pegadas abajo: se contesta sin subir ni bajar.
 *
 * Los números llevan la letra ya elegida, para saber de un vistazo qué queda.
 * El enunciado de la pregunta enfocada va dentro de la barra a propósito: sin
 * él, «pregunta 3» no le dice nada a quien está leyendo los anuncios.
 *
 * Es un segundo mando sobre la MISMA respuesta que la caja de arriba, no otra
 * respuesta: las dos llaman a `alMarcar`, y lo que se pinta sale de `marcadas`.
 * En lista común la caja de arriba usa radios y esta un desplegable, para que
 * no queden dos grupos de radios con el mismo `name` peleándose.
 */
function BarraDeRespuestas({
  preguntas, marcadas, bloqueada, alMarcar,
}: {
  preguntas: PreguntaDeLaBarra[];
  marcadas: Marcadas;
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const [enfocada, setEnfocada] = useState(preguntas[0]?.numero ?? 0);
  const pregunta = preguntas.find((p) => p.numero === enfocada) ?? preguntas[0];
  if (!pregunta) return null;

  return (
    <div
      data-barra-respuestas
      className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-tinta-suave/20 bg-white p-3 md:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex flex-wrap gap-1.5">
        {preguntas.map((p) => {
          const letra = marcadas[String(p.numero)] ?? "";
          return (
            <button
              key={p.numero}
              type="button"
              aria-current={p.numero === pregunta.numero ? "true" : undefined}
              onClick={() => setEnfocada(p.numero)}
              className={`min-w-11 rounded-full px-2.5 py-1.5 text-sm font-bold ${p.numero === pregunta.numero ? "bg-tinta text-white" : "border border-tinta-suave/30"}`}
            >
              {p.numero}
              {letra ? ` ${letra}` : ""}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-tinta-suave">
        {pregunta.numero}. {pregunta.texto}
      </p>
      <Desplegable
        id={`barra-${pregunta.numero}`}
        etiqueta={`Pregunta ${pregunta.numero}, respuesta rápida`}
        marcador="Elige una letra"
        opciones={pregunta.letras.map((l) => ({ valor: l, texto: l }))}
        value={marcadas[String(pregunta.numero)] ?? ""}
        disabled={bloqueada}
        onChange={(ev) => alMarcar(pregunta.numero, ev.target.value)}
        className="w-full p-3"
      />
    </div>
  );
}

/**
 * Las preguntas de UNA tarea, tal como las hace el estudiante. No sabe nada
 * del reloj, del audio ni de guardar: eso lo pone encima quien la use.
 */
export function TareaDelEstudiante({
  tarea, marcadas, fallos, bloqueada, alMarcar,
}: {
  tarea: TareaParaHacer;
  marcadas: Marcadas;
  /** Los números fallados. null mientras no esté corregida. */
  fallos: number[] | null;
  /** Entregada: se ve, no se toca. */
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}) {
  const f = tarea.formulario;
  const { referencia, preguntas } = partesDe(f, tarea.regla, marcadas, fallos, bloqueada, alMarcar);
  const textos = f.forma === "HUECOS" ? <TextoHuecos f={f} /> : f.textos.map((t, i) => <TextoSuelto key={i} etiqueta={t.etiqueta} texto={t.texto} />);
  // Hay columna de consulta si hay ALGO que consultar: el texto largo de
  // huecos, los textos sueltos de la lectura 3, los destinos de relacionar o
  // la lista común. Solo la auditiva 1 y la 4 se quedan sin ella, y con razón:
  // ahí no hay nada que mirar mientras se contesta, se escucha.
  const hayConsulta = f.forma === "HUECOS" || f.textos.length > 0 || referencia !== null;
  // Dos columnas solo desde md: a 400 px nunca hay dos columnas. Ahí lo que
  // resuelve el ir y venir es la barra de abajo.
  const barra = preguntasParaLaBarra(f);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-bold">{f.consigna}</p>
      {hayConsulta ? (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-4 md:max-h-[70vh] md:overflow-y-auto">
            {textos}
            {referencia}
          </div>
          <div className="flex flex-col gap-4">{preguntas}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {textos}
          {preguntas}
        </div>
      )}
      {/* Solo relacionar y lista común dan preguntas para la barra, y las dos
          tienen siempre material que consultar: no hace falta preguntar por
          `hayConsulta`, sería una guarda que nunca puede ser falsa aquí. */}
      {barra.length > 0 && (
        <BarraDeRespuestas preguntas={barra} marcadas={marcadas} bloqueada={bloqueada} alMarcar={alMarcar} />
      )}
    </div>
  );
}
