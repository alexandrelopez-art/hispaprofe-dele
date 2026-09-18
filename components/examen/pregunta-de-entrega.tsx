"use client";

import { useEffect, useRef } from "react";
import { Boton } from "@/components/ui/boton";

/**
 * La pregunta de antes de entregar, como <dialog> de la página y no como
 * `confirm()` del navegador: se viste, se prueba, dice tarea a tarea qué
 * falta y Escape la cierra (evento `close` → `alNo`, igual que
 * `VentanaDeSalida`). La entrega por el reloj NO pasa por aquí: esa se
 * manda sola, sin preguntar, porque ya no hay tiempo para seguir.
 */
export function PreguntaDeEntrega({
  abierta,
  falta,
  enviando,
  textoSeguir,
  alSi,
  alNo,
}: {
  abierta: boolean;
  falta: string[];
  enviando: boolean;
  textoSeguir: string;
  alSi: () => void;
  alNo: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ventana.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ventana}
      onClose={alNo}
      aria-labelledby="titulo-de-entregar"
      className="m-auto max-w-md rounded-tarjeta p-6 shadow-tarjeta backdrop:bg-tinta/40"
    >
      <h2 id="titulo-de-entregar" className="text-lg font-bold">
        ¿Entregar ya?
      </h2>
      {falta.length > 0 && (
        <>
          <p className="mt-2">Ojo:</p>
          <ul className="mt-1 list-disc pl-5 text-tinta-suave">
            {falta.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2">¿Entregar de todas formas?</p>
        </>
      )}
      <p className="mt-2 text-tinta-suave">Entregar no se puede deshacer.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" onClick={alNo} disabled={enviando} autoFocus>
          {textoSeguir}
        </Boton>
        <Boton onClick={alSi} enviando={enviando} textoEnviando="Entregando…">
          Sí, entregar
        </Boton>
      </div>
    </dialog>
  );
}
