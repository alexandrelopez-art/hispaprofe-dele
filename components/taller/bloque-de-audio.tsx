"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import type { Medios } from "@/lib/taller/formas";
import { muestrasDeAudio } from "@/lib/taller/medios-en-navegador";
import { formatearTiempo, leerCortesEscritos, picos, proponerCortes, silencios, trozosDe, type Silencio } from "@/lib/taller/onda";
import { CAJA } from "./campo";
import { Onda } from "./onda";

const CUBOS = 1200;
type Leida = { picos: number[]; silencios: Silencio[]; duracion: number };

async function leerPista(datos: ArrayBuffer): Promise<Leida> {
  const { muestras, frecuencia, duracion } = await muestrasDeAudio(datos);
  return { picos: picos(muestras, CUBOS), silencios: silencios(muestras, frecuencia), duracion };
}

/** La pista de una tarea de auditiva: subirla, ver la onda, poner las marcas y oír cada trozo. */
export function BloqueDeAudio({ audio, trozos, alCambiar }: { audio: Medios["audio"]; trozos: number; alCambiar: (audio: Medios["audio"]) => void }) {
  const [leida, setLeida] = useState<Leida | null>(null);
  const [sinOnda, setSinOnda] = useState(false);
  const [duracionDelReproductor, setDuracionDelReproductor] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reproductor = useRef<HTMLAudioElement>(null);
  const hasta = useRef<number | null>(null);
  const cortaSinMarcas = trozos === 1;

  // Al volver a abrir una tarea guardada, la onda se pide al almacén. Si el almacén
  // no deja leerla desde el navegador (CORS) o no se descodifica, queda el campo a mano.
  // Depende solo del id de la pista: mover una marca no vuelve a descargarla.
  const ficheroDeLaPista = audio?.fichero ?? null;
  useEffect(() => {
    if (!ficheroDeLaPista || leida || sinOnda || cortaSinMarcas) return;
    let vivo = true;
    fetch(`/api/ficheros/${ficheroDeLaPista}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(leerPista)
      .then((l) => { if (vivo) setLeida(l); })
      .catch(() => { if (vivo) setSinOnda(true); });
    return () => { vivo = false; };
  }, [ficheroDeLaPista, leida, sinOnda, cortaSinMarcas]);

  async function elegir(fichero: File | undefined) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    let nueva: Leida | null = null;
    try {
      nueva = cortaSinMarcas ? null : await leerPista(await fichero.arrayBuffer());
    } catch {
      nueva = null;
    }
    try {
      const id = await subirAlAlmacen(fichero);
      setLeida(nueva);
      setSinOnda(!cortaSinMarcas && nueva === null);
      alCambiar({ fichero: id, cortes: nueva ? proponerCortes(nueva.silencios, trozos, nueva.duracion) : [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la pista.");
    } finally {
      setSubiendo(false);
    }
  }

  function oir(inicio: number, fin: number) {
    const el = reproductor.current;
    if (!el) return;
    hasta.current = fin;
    el.currentTime = inicio;
    void el.play();
  }

  const selector = (texto: string) => (
    <label className="cursor-pointer self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
      {subiendo ? "Subiendo…" : texto}
      <input type="file" accept="audio/*" className="sr-only" disabled={subiendo} onChange={(e) => elegir(e.target.files?.[0])} />
    </label>
  );

  if (!audio) {
    return (
      <section data-bloque-audio className={`${CAJA} bg-sol-100`}>
        <h3 className="font-bold">Audio</h3>
        {selector("Subir la pista")}
        {error && <Aviso tono="error">{error}</Aviso>}
      </section>
    );
  }

  const duracion = leida?.duracion ?? duracionDelReproductor;
  const marcas = audio.cortes.length;
  const cuadra = marcas + 1 === trozos;
  const cambiarCortes = (cortes: number[]) => alCambiar({ ...audio, cortes });

  return (
    <section data-bloque-audio className={CAJA}>
      <h3 className="font-bold">Audio</h3>
      <audio
        ref={reproductor}
        src={`/api/ficheros/${audio.fichero}`}
        preload="metadata"
        controls
        className="w-full"
        onLoadedMetadata={(e) => setDuracionDelReproductor(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (hasta.current !== null && e.currentTarget.currentTime >= hasta.current) {
            e.currentTarget.pause();
            hasta.current = null;
          }
        }}
      />
      {cortaSinMarcas ? (
        <p className="text-tinta-suave">Esta tarea no se corta: suena la pista entera.</p>
      ) : (
        <>
          <p data-contador={cuadra ? "bien" : "mal"} className={`font-bold ${cuadra ? "text-verde-600" : "text-coral-600"}`}>
            {`${marcas} ${marcas === 1 ? "marca" : "marcas"} → ${marcas + 1} ${marcas + 1 === 1 ? "trozo" : "trozos"}, esta tarea lleva ${trozos}`}
          </p>
          {leida && <Onda picos={leida.picos} duracion={leida.duracion} cortes={audio.cortes} alCambiar={cambiarCortes} />}
          {!leida && !sinOnda && <p className="text-tinta-suave">Dibujando la onda…</p>}
          {sinOnda && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-tinta-suave">No se pudo dibujar la onda. Escribe las marcas en segundos, separadas por comas (22, 38.5 o 1:05)</span>
              <input
                type="text"
                defaultValue={audio.cortes.join(", ")}
                className="w-full rounded-xl border border-tinta-suave/30 p-3"
                onBlur={(e) => {
                  const cortes = leerCortesEscritos(e.target.value);
                  if (cortes === null) setError("Las marcas tienen que ir en orden, separadas por comas: 22, 38.5 o 1:05.");
                  else { setError(null); cambiarCortes(cortes); }
                }}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {leida && (
              <Boton variante="secundario" className="px-3 py-1" onClick={() => cambiarCortes(proponerCortes(leida.silencios, trozos, leida.duracion))}>
                Proponer marcas por los silencios
              </Boton>
            )}
            {selector("Cambiar la pista")}
          </div>
        </>
      )}
      {/* La lista de trozos se oculta en las tareas que no se cortan (trozos === 1): con una
          sola pista, el reproductor nativo de arriba ya basta y no hace falta una fila
          "Trozo 1 · …" redundante. No hay prueba automática de esto: `duracion` depende de
          onLoadedMetadata o de leerPista, que solo corren con un navegador real, así que
          renderToStaticMarkup nunca la pinta y ninguna prueba de este fichero puede
          distinguir el guard correcto del roto. Se comprueba en la aceptación manual. */}
      {duracion !== null && !cortaSinMarcas && (
        <ol className="flex flex-col gap-2">
          {trozosDe(audio.cortes, duracion).map(([inicio, fin], i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{`Trozo ${i + 1} · ${formatearTiempo(inicio)}–${formatearTiempo(fin)}`}</span>
              <Boton variante="secundario" className="px-3 py-1" onClick={() => oir(inicio, fin)}>Oír</Boton>
              {i > 0 && (
                <>
                  <Boton variante="secundario" className="px-3 py-1" onClick={() => oir(inicio, inicio + 5)}>Oír 5 s desde la marca</Boton>
                  <Boton variante="secundario" className="px-3 py-1" onClick={() => cambiarCortes(audio.cortes.filter((_, j) => j !== i - 1))}>Quitar marca</Boton>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </section>
  );
}
