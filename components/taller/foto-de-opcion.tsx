"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import { reducirFoto } from "@/lib/taller/medios-en-navegador";

/** El hueco de la foto de una opción: subir, ver, cambiar o quitar. Sin foto se pinta en amarillo, como un campo que falta. */
export function FotoDeOpcion({
  clave,
  etiqueta,
  ficheroId,
  alCambiar,
}: {
  clave: string;
  etiqueta: string;
  ficheroId: string | null;
  alCambiar: (ficheroId: string | null) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(fichero: File | undefined) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    try {
      alCambiar(await subirAlAlmacen(await reducirFoto(fichero)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  const selector = (texto: string) => (
    <label className="cursor-pointer self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
      {subiendo ? "Subiendo…" : texto}
      <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => elegir(e.target.files?.[0])} />
    </label>
  );

  return (
    <div data-foto={clave} className={`flex min-w-0 flex-col gap-2 rounded-xl p-3 ${ficheroId ? "bg-hp-50" : "bg-sol-100"}`}>
      <span className="text-sm font-bold text-tinta-suave">{etiqueta}</span>
      {ficheroId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos */}
          <img src={`/api/ficheros/${ficheroId}`} alt={etiqueta} className="max-h-48 w-auto max-w-full self-start rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {selector("Cambiar")}
            <Boton variante="secundario" onClick={() => alCambiar(null)}>Quitar</Boton>
          </div>
        </>
      ) : (
        selector("Subir foto")
      )}
      {error && <span role="alert" className="text-error-600">{error}</span>}
    </div>
  );
}
