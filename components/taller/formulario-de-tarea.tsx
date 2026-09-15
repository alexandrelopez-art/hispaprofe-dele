"use client";

import { useMemo, useState, useTransition } from "react";
import { guardarTareaAccion, rellenarTareaConIAAccion } from "@/app/examenes/acciones";
import type { ReglaTarea } from "@/lib/dele/estructura";
import { cambiar as cambiarEn, type Ruta } from "@/lib/taller/editar";
import type { EstadoDeTarea } from "@/lib/taller/estado";
import { formularioVacio, type Formulario, type Medios } from "@/lib/taller/formas";
import { etiquetaDeDuda, quitarDudasDe, tieneAlgoEscrito, type Duda } from "@/lib/taller/ia/dudas";
import { conMediosDe } from "@/lib/taller/medios";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
import { BloqueDeAudio } from "./bloque-de-audio";
import { CAJA, Campo } from "./campo";
import { DudasContext } from "./dudas";
import { EstadoDeLaTarea } from "./estado-de-la-tarea";
import { FormaHuecos, FormaListaComun, FormaOpciones, FormaRelacionar } from "./formas-cerradas";
import { FormaOralDirecto, FormaOralSolo, FormaRedaccionDos, FormaRedaccionUna } from "./formas-abiertas";

type Props = {
  examenId: string;
  prueba: string;
  numero: number;
  regla: ReglaTarea;
  inicial: Formulario;
  respuestas: Record<string, string> | null;
  temasDeLaHermana: string[] | null;
  estadoInicial: EstadoDeTarea;
  hayClave: boolean;
  hayHojas: boolean;
  publicado: boolean;
};

export function FormularioDeTarea({ examenId, prueba, numero, regla, inicial, respuestas, temasDeLaHermana, estadoInicial, hayClave, hayHojas, publicado }: Props) {
  const [f, setF] = useState<Formulario>(inicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [error, setError] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardando, empezar] = useTransition();
  const [dudas, setDudas] = useState<Duda[]>([]);
  const [rellenando, empezarRelleno] = useTransition();
  const mapaDeDudas = useMemo(() => new Map(dudas.map((d) => [d.clave, d.nota])), [dudas]);
  const rellenoApagado = !hayClave || !hayHojas || rellenando || guardando || publicado;

  const cambiar = (ruta: Ruta, valor: unknown) => {
    setF((actual) => cambiarEn(actual, ruta, valor));
    setDudas((actuales) => quitarDudasDe(actuales, ruta));
    setSinGuardar(true);
  };

  // Con la función de setF y no con `f`: dos fotos que terminan de subir casi a la vez no se pisan.
  const cambiarImagen = (clave: string, ficheroId: string | null) => {
    setF((actual) => {
      const imagenes = { ...actual.medios.imagenes };
      if (ficheroId) imagenes[clave] = ficheroId;
      else delete imagenes[clave];
      return cambiarEn(actual, ["medios", "imagenes"], imagenes);
    });
    setSinGuardar(true);
  };
  const cambiarAudio = (audio: Medios["audio"]) => {
    setF((actual) => cambiarEn(actual, ["medios", "audio"], audio));
    setSinGuardar(true);
  };

  function guardar() {
    setError(null);
    empezar(async () => {
      try {
        const r = await guardarTareaAccion(examenId, prueba, numero, f);
        if ("error" in r) setError(r.error);
        else {
          setEstado(r.estado);
          setSinGuardar(false);
          setDudas([]);
        }
      } catch {
        setError("No se ha podido guardar. Revisa la conexión y vuelve a pulsar Guardar.");
      }
    });
  }

  function rellenar() {
    if (tieneAlgoEscrito(f, formularioVacio(regla)) && !window.confirm("Se sustituirá lo escrito por lo que lea la IA. ¿Seguir?")) return;
    setError(null);
    empezarRelleno(async () => {
      try {
        const r = await rellenarTareaConIAAccion(examenId, prueba, numero);
        if ("error" in r) setError(r.error);
        else {
          // La IA no ve las fotos ni la pista: se quedan las que hay en pantalla.
          setF((actual) => conMediosDe(r.formulario, actual));
          setDudas(r.dudas);
          setSinGuardar(true);
        }
      } catch {
        setError("No se ha podido rellenar. Revisa la conexión y vuelve a pulsar Rellenar con IA.");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DudasContext.Provider value={mapaDeDudas}>
        {publicado && <p role="status" className="rounded-2xl bg-sol-100 p-4 font-bold">{MENSAJE_PUBLICADO}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {/* El apagado no se calcula con la utilidad disabled: de Tailwind: la palabra "disabled" literal en la clase
              rompería cualquier prueba que busque el atributo real, aun con el botón encendido. */}
          <button
            type="button"
            onClick={rellenar}
            disabled={rellenoApagado}
            className={`rounded-2xl border border-hp-400 px-5 py-2 font-bold text-hp-600 ${rellenoApagado ? "opacity-50" : ""}`}
          >
            {rellenando ? "Leyendo las hojas…" : "Rellenar con IA"}
          </button>
          {!hayHojas && <span className="text-tinta-suave">Etiqueta primero las hojas de esta tarea.</span>}
          {hayHojas && !hayClave && <span className="text-tinta-suave">Falta la clave de la IA.</span>}
        </div>
        {dudas.length > 0 && (
          <section className={CAJA} data-lista-de-dudas>
            <h3 className="font-bold">La IA duda en {dudas.length} {dudas.length === 1 ? "sitio" : "sitios"} (marcados en amarillo)</h3>
            <ul className="list-disc pl-5">
              {dudas.map((d) => <li key={d.clave}><strong>{etiquetaDeDuda(d.clave)}:</strong> {d.nota}</li>)}
            </ul>
          </section>
        )}
        <EstadoDeLaTarea estado={estado} />
        {/* Mientras la IA lee las hojas, los campos se apagan para no perder lo que el
            profesor escriba mientras espera: el botón y la lista de dudas quedan fuera. */}
        <fieldset disabled={rellenando || publicado} className="contents">
          {regla.trozos ? <BloqueDeAudio audio={f.medios.audio} trozos={regla.trozos} alCambiar={cambiarAudio} /> : null}
          <section className={CAJA}>
            <Campo etiqueta="Consigna, ya corregida (sin «Hoja de respuestas»)" valor={f.consigna} alCambiar={(v) => cambiar(["consigna"], v)} ruta={["consigna"]} largo />
          </section>
          {f.textos.map((t, i) => (
            <section key={i} className={CAJA}>
              <h3 className="font-bold">Texto {i + 1}</h3>
              <Campo etiqueta="Nombre o título" valor={t.etiqueta} alCambiar={(v) => cambiar(["textos", i, "etiqueta"], v)} ruta={["textos", i, "etiqueta"]} opcional />
              <Campo etiqueta="Texto" valor={t.texto} alCambiar={(v) => cambiar(["textos", i, "texto"], v)} ruta={["textos", i, "texto"]} largo />
            </section>
          ))}

          {f.forma === "RELACIONAR" && <FormaRelacionar f={f} regla={regla} cambiar={cambiar} respuestas={respuestas} />}
          {f.forma === "LISTA_COMUN" && <FormaListaComun f={f} cambiar={cambiar} respuestas={respuestas} />}
          {f.forma === "OPCIONES" && <FormaOpciones f={f} cambiar={cambiar} respuestas={respuestas} cambiarImagen={cambiarImagen} />}
          {f.forma === "HUECOS" && <FormaHuecos f={f} cambiar={cambiar} respuestas={respuestas} />}
          {f.forma === "REDACCION_UNA" && <FormaRedaccionUna f={f} cambiar={cambiar} />}
          {f.forma === "REDACCION_DOS" && <FormaRedaccionDos f={f} cambiar={cambiar} />}
          {f.forma === "ORAL_SOLO" && <FormaOralSolo f={f} cambiar={cambiar} cambiarImagen={cambiarImagen} />}
          {f.forma === "ORAL_DIRECTO" && <FormaOralDirecto f={f} cambiar={cambiar} temasDeLaHermana={temasDeLaHermana} />}
        </fieldset>

        {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-tinta-suave/20 bg-fondo py-3">
          <button type="button" onClick={guardar} disabled={guardando || rellenando || publicado} className="rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {sinGuardar && <span className="text-tinta-suave">Hay cambios sin guardar.</span>}
        </div>
      </DudasContext.Provider>
    </div>
  );
}
