"use client";

import type { ReglaTarea } from "@/lib/dele/estructura";
import type { Cambiar } from "@/lib/taller/editar";
import type { FormularioDe } from "@/lib/taller/formas";
import { CAJA, CampoDelTaller, Letra, Respuesta } from "./campo";
import { FotoDeOpcion } from "./foto-de-opcion";

type Respuestas = Record<string, string> | null;
type Opcion = { letra: string; texto: string; conImagen?: boolean };
type Fotos = { imagenes: Record<string, string>; cambiarImagen: (clave: string, ficheroId: string | null) => void };

function Opciones({ opciones, ruta, cambiar, fotos, claveDe }: { opciones: Opcion[]; ruta: (string | number)[]; cambiar: Cambiar; fotos?: Fotos; claveDe?: (letra: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      {opciones.map((o, i) =>
        o.conImagen && fotos && claveDe ? (
          <FotoDeOpcion
            key={o.letra}
            clave={claveDe(o.letra)}
            etiqueta={`Opción ${o.letra}`}
            ficheroId={fotos.imagenes[claveDe(o.letra)] ?? null}
            alCambiar={(id) => fotos.cambiarImagen(claveDe(o.letra), id)}
          />
        ) : (
          <CampoDelTaller key={o.letra} etiqueta={`Opción ${o.letra}`} valor={o.texto} alCambiar={(v) => cambiar([...ruta, i, "texto"], v)} ruta={[...ruta, i, "texto"]} />
        ),
      )}
    </div>
  );
}

function Cabecera({ titulo, numero, respuestas }: { titulo: string; numero: number; respuestas: Respuestas }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">{titulo}</h3>
      <Respuesta numero={numero} respuestas={respuestas} />
    </div>
  );
}

export function FormaRelacionar({ f, regla, cambiar, respuestas }: { f: FormularioDe<"RELACIONAR">; regla: ReglaTarea; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  const conTexto = Boolean(regla.elementosConTexto);
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Ejemplo (0)</h3>
        {conTexto && <CampoDelTaller etiqueta="Texto del ejemplo" valor={a.ejemplo.texto} alCambiar={(v) => cambiar(["actividad", "ejemplo", "texto"], v)} ruta={["actividad", "ejemplo", "texto"]} largo />}
        <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} ruta={["actividad", "ejemplo", "letra"]} />
      </section>
      {a.elementos.map((e, i) => (
        <section key={e.numero} className={CAJA}>
          <Cabecera titulo={conTexto ? `${e.numero}` : `Mensaje ${i + 1} (${e.numero})`} numero={e.numero} respuestas={respuestas} />
          {conTexto && <CampoDelTaller etiqueta={`Texto de la ${e.numero}`} valor={e.texto} alCambiar={(v) => cambiar(["actividad", "elementos", i, "texto"], v)} ruta={["actividad", "elementos", i, "texto"]} largo />}
        </section>
      ))}
      {a.destinos.map((d, i) => (
        <section key={d.letra} className={CAJA}>
          <h3 className="font-bold">Texto {d.letra}</h3>
          <CampoDelTaller etiqueta="Título" valor={d.titulo} alCambiar={(v) => cambiar(["actividad", "destinos", i, "titulo"], v)} ruta={["actividad", "destinos", i, "titulo"]} opcional />
          <CampoDelTaller etiqueta="Texto" valor={d.texto} alCambiar={(v) => cambiar(["actividad", "destinos", i, "texto"], v)} ruta={["actividad", "destinos", i, "texto"]} largo />
        </section>
      ))}
    </>
  );
}

export function FormaListaComun({ f, cambiar, respuestas }: { f: FormularioDe<"LISTA_COMUN">; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Lista común</h3>
        {a.comunes.map((c, i) => (
          <CampoDelTaller key={c.letra} etiqueta={`Opción ${c.letra}`} valor={c.texto} alCambiar={(v) => cambiar(["actividad", "comunes", i, "texto"], v)} ruta={["actividad", "comunes", i, "texto"]} />
        ))}
      </section>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <CampoDelTaller etiqueta="Enunciado del ejemplo" valor={a.ejemplo.enunciado} alCambiar={(v) => cambiar(["actividad", "ejemplo", "enunciado"], v)} ruta={["actividad", "ejemplo", "enunciado"]} />
          <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} ruta={["actividad", "ejemplo", "letra"]} />
        </section>
      )}
      {a.preguntas.map((p, i) => (
        <section key={p.numero} className={CAJA}>
          <Cabecera titulo={`${p.numero}`} numero={p.numero} respuestas={respuestas} />
          <CampoDelTaller etiqueta="Enunciado" valor={p.enunciado} alCambiar={(v) => cambiar(["actividad", "preguntas", i, "enunciado"], v)} ruta={["actividad", "preguntas", i, "enunciado"]} />
        </section>
      ))}
    </>
  );
}

export function FormaOpciones({ f, cambiar, respuestas, cambiarImagen }: { f: FormularioDe<"OPCIONES">; cambiar: Cambiar; respuestas: Respuestas; cambiarImagen: Fotos["cambiarImagen"] }) {
  const a = f.actividad;
  const fotos = { imagenes: f.medios.imagenes, cambiarImagen };
  return (
    <>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <CampoDelTaller etiqueta="Enunciado del ejemplo" valor={a.ejemplo.enunciado} alCambiar={(v) => cambiar(["actividad", "ejemplo", "enunciado"], v)} ruta={["actividad", "ejemplo", "enunciado"]} />
          <Opciones opciones={a.ejemplo.opciones} ruta={["actividad", "ejemplo", "opciones"]} cambiar={cambiar} fotos={fotos} claveDe={(l) => `ejemplo-${l}`} />
          <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} ruta={["actividad", "ejemplo", "letra"]} />
        </section>
      )}
      {a.preguntas.map((p, i) => (
        <section key={p.numero} className={CAJA}>
          {p.grupo !== null && (i === 0 || a.preguntas[i - 1].grupo !== p.grupo) && (
            <p className="text-sm font-bold uppercase text-hp-600">Noticia {p.grupo}</p>
          )}
          <Cabecera titulo={`${p.numero}`} numero={p.numero} respuestas={respuestas} />
          <CampoDelTaller etiqueta="Enunciado" valor={p.enunciado} alCambiar={(v) => cambiar(["actividad", "preguntas", i, "enunciado"], v)} ruta={["actividad", "preguntas", i, "enunciado"]} />
          <Opciones opciones={p.opciones} ruta={["actividad", "preguntas", i, "opciones"]} cambiar={cambiar} fotos={fotos} claveDe={(l) => `${p.numero}-${l}`} />
        </section>
      ))}
    </>
  );
}

export function FormaHuecos({ f, cambiar, respuestas }: { f: FormularioDe<"HUECOS">; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  return (
    <>
      <section className={CAJA}>
        <CampoDelTaller etiqueta="Título" valor={a.titulo} alCambiar={(v) => cambiar(["actividad", "titulo"], v)} ruta={["actividad", "titulo"]} opcional />
        <CampoDelTaller etiqueta="Texto, con cada hueco marcado así: [19]" valor={a.texto} alCambiar={(v) => cambiar(["actividad", "texto"], v)} ruta={["actividad", "texto"]} largo />
        <CampoDelTaller etiqueta="Autor o fuente" valor={a.fuente} alCambiar={(v) => cambiar(["actividad", "fuente"], v)} ruta={["actividad", "fuente"]} opcional />
      </section>
      {a.huecos.map((h, i) => (
        <section key={h.numero} className={CAJA}>
          <Cabecera titulo={`Hueco ${h.numero}`} numero={h.numero} respuestas={respuestas} />
          <Opciones opciones={h.opciones} ruta={["actividad", "huecos", i, "opciones"]} cambiar={cambiar} />
        </section>
      ))}
    </>
  );
}
