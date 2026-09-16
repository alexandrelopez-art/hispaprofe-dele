"use client";

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

const CAJA = "flex min-w-0 flex-col gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4";

/** La caja de una pregunta: roja y con `data-fallo` si el estudiante la falló. */
function cajaPregunta(fallo: boolean): string {
  return `flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 ${fallo ? "border-error-600" : "border-tinta-suave/20"}`;
}

function esFallo(numero: number, fallos: number[] | null): boolean {
  return fallos?.includes(numero) ?? false;
}

function ActividadRelacionar({
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
      {a.elementos.map((e) => {
        const fallo = esFallo(e.numero, fallos);
        return (
          <section key={e.numero} data-pregunta={e.numero} data-fallo={fallo ? e.numero : undefined} className={cajaPregunta(fallo)}>
            <h3 className="font-bold">Pregunta {e.numero}</h3>
            {conTexto && <p className="whitespace-pre-wrap">{e.texto}</p>}
            <select
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

function ActividadListaComun({
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
  return (
    <label className={`flex items-center gap-3 rounded-xl border p-2 ${seleccionada ? "border-hp-400" : "border-tinta-suave/30"}`}>
      <input type="radio" name={nombre} value={letra} checked={seleccionada} disabled={disabled} onChange={onChange} />
      {conImagen ? (
        // eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos
        <img src={`/api/ficheros/${ficheroId}`} alt={`Opción ${letra}`} className="max-h-32 w-auto max-w-full rounded-lg" />
      ) : (
        <span>
          {letra}. {texto}
        </span>
      )}
    </label>
  );
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
          <div className="flex flex-col gap-2">
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
              <p className="text-sm font-bold uppercase text-hp-600">Noticia {p.grupo}</p>
            )}
            <h3 className="font-bold">Pregunta {p.numero}</h3>
            <p>{p.enunciado}</p>
            <div className="flex flex-col gap-2">
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

function actividadDe(
  f: Formulario,
  regla: ReglaTarea,
  marcadas: Marcadas,
  fallos: number[] | null,
  bloqueada: boolean,
  alMarcar: (numero: number, letra: string) => void,
) {
  switch (f.forma) {
    case "RELACIONAR":
      return <ActividadRelacionar f={f} regla={regla} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />;
    case "LISTA_COMUN":
      return <ActividadListaComun f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />;
    case "OPCIONES":
      return <ActividadOpciones f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />;
    case "HUECOS":
      return <ActividadHuecos f={f} marcadas={marcadas} fallos={fallos} bloqueada={bloqueada} alMarcar={alMarcar} />;
    default:
      return null;
  }
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
  // El texto largo va junto a sus preguntas, en dos columnas solo desde
  // md: a 400 px nunca hay dos columnas, siempre una debajo de otra.
  const dosColumnas = f.forma === "HUECOS" || (f.forma === "OPCIONES" && f.textos.length > 0);
  const columnaTextos = f.forma === "HUECOS" ? <TextoHuecos f={f} /> : f.textos.map((t, i) => <TextoSuelto key={i} etiqueta={t.etiqueta} texto={t.texto} />);
  const actividad = actividadDe(f, tarea.regla, marcadas, fallos, bloqueada, alMarcar);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-bold">{f.consigna}</p>
      {dosColumnas ? (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-4 md:max-h-[70vh] md:overflow-y-auto">{columnaTextos}</div>
          <div className="flex flex-col gap-4">{actividad}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {columnaTextos}
          {actividad}
        </div>
      )}
    </div>
  );
}
