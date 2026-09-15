"use client";

import type { Cambiar } from "@/lib/taller/editar";
import type { FormularioDe } from "@/lib/taller/formas";
import { CAJA, Campo, Numero, Pautas } from "./campo";

type Rango = { min: number | null; max: number | null };

function RangoDe({ etiqueta, valor, ruta, cambiar }: { etiqueta: string; valor: Rango; ruta: string[]; cambiar: Cambiar }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Numero etiqueta={`${etiqueta}: mínimo`} valor={valor.min} alCambiar={(v) => cambiar([...ruta, "min"], v)} ruta={[...ruta, "min"]} />
      <Numero etiqueta={`${etiqueta}: máximo`} valor={valor.max} alCambiar={(v) => cambiar([...ruta, "max"], v)} ruta={[...ruta, "max"]} />
    </div>
  );
}

export function FormaRedaccionUna({ f, cambiar }: { f: FormularioDe<"REDACCION_UNA">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <section className={CAJA}>
      <Campo etiqueta="Situación" valor={a.situacion} alCambiar={(v) => cambiar(["actividad", "situacion"], v)} ruta={["actividad", "situacion"]} largo />
      <Campo etiqueta="Texto recibido (el correo, la nota…)" valor={a.textoRecibido} alCambiar={(v) => cambiar(["actividad", "textoRecibido"], v)} ruta={["actividad", "textoRecibido"]} largo opcional />
      <Pautas etiqueta="En tu respuesta, no olvides:" pautas={a.pautas} alCambiar={(v) => cambiar(["actividad", "pautas"], v)} ruta={["actividad", "pautas"]} />
      <RangoDe etiqueta="Palabras" valor={a.palabras} ruta={["actividad", "palabras"]} cambiar={cambiar} />
    </section>
  );
}

export function FormaRedaccionDos({ f, cambiar }: { f: FormularioDe<"REDACCION_DOS">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Opción {i + 1}</h3>
          <Campo etiqueta="Título" valor={o.titulo} alCambiar={(v) => cambiar(["actividad", "opciones", i, "titulo"], v)} ruta={["actividad", "opciones", i, "titulo"]} opcional />
          <Campo etiqueta="Contexto" valor={o.contexto} alCambiar={(v) => cambiar(["actividad", "opciones", i, "contexto"], v)} ruta={["actividad", "opciones", i, "contexto"]} largo />
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} ruta={["actividad", "opciones", i, "pautas"]} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Palabras" valor={a.palabras} ruta={["actividad", "palabras"]} cambiar={cambiar} />
      </section>
    </>
  );
}

export function FormaOralSolo({ f, cambiar }: { f: FormularioDe<"ORAL_SOLO">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Opción {i + 1}</h3>
          <Campo etiqueta="Tema" valor={o.tema} alCambiar={(v) => cambiar(["actividad", "opciones", i, "tema"], v)} ruta={["actividad", "opciones", i, "tema"]} />
          {o.conImagen && <p className="rounded-xl bg-hp-50 p-3 text-tinta-suave">Foto: se sube en la Entrega 3</p>}
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} ruta={["actividad", "opciones", i, "pautas"]} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Minutos" valor={a.minutos} ruta={["actividad", "minutos"]} cambiar={cambiar} />
        <Numero etiqueta="Minutos de preparación" valor={a.preparacion} alCambiar={(v) => cambiar(["actividad", "preparacion"], v)} ruta={["actividad", "preparacion"]} />
      </section>
    </>
  );
}

export function FormaOralDirecto({ f, cambiar, temasDeLaHermana }: { f: FormularioDe<"ORAL_DIRECTO">; cambiar: Cambiar; temasDeLaHermana: string[] | null }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Opción {i + 1}</h3>
            <span className="rounded-full bg-hp-50 px-3 py-1 text-sm">Va con: {temasDeLaHermana?.[i] || "(la otra tarea aún no tiene tema)"}</span>
          </div>
          <Campo etiqueta="Tema" valor={o.tema} alCambiar={(v) => cambiar(["actividad", "opciones", i, "tema"], v)} ruta={["actividad", "opciones", i, "tema"]} />
          <Campo etiqueta="Situación" valor={o.situacion} alCambiar={(v) => cambiar(["actividad", "opciones", i, "situacion"], v)} ruta={["actividad", "opciones", i, "situacion"]} largo />
          <Campo etiqueta="Papel del examinador" valor={o.papelExaminador} alCambiar={(v) => cambiar(["actividad", "opciones", i, "papelExaminador"], v)} ruta={["actividad", "opciones", i, "papelExaminador"]} largo opcional />
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} ruta={["actividad", "opciones", i, "pautas"]} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Minutos" valor={a.minutos} ruta={["actividad", "minutos"]} cambiar={cambiar} />
      </section>
    </>
  );
}
