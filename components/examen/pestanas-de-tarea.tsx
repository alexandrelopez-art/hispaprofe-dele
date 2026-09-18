"use client";

import type { TareaParaHacer } from "@/lib/examen/paraHacer";

/**
 * Las pestañas de las tareas. Cambiar de pestaña es solo estado local: no va al
 * servidor.
 *
 * `bloqueadas` las apaga mientras suena un trozo racionado. Cambiar de tarea
 * con el audio sonando desmonta la cinta (le cambia la `key`), y ese trozo ya
 * está apuntado como oído en el servidor: se perdería sin haber sonado entero
 * y sin ningún aviso. No se pregunta con un `confirm` a propósito: un cartel a
 * mitad de una audición es justo lo que no puede pasar mientras se escucha.
 *
 * Exportada para poder pintarla sola en las pruebas: `renderToStaticMarkup`
 * solo ve el estado inicial de `PruebaHaciendo`, donde nada suena todavía.
 */
export function PestanasDeTarea({
  tareas, abierta, alElegir, bloqueadas = false,
}: {
  tareas: TareaParaHacer[];
  abierta: number;
  alElegir: (numero: number) => void;
  bloqueadas?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tareas.map((t) => (
        <button
          key={t.numero}
          type="button"
          aria-current={t.numero === abierta ? "true" : undefined}
          disabled={bloqueadas}
          onClick={() => alElegir(t.numero)}
          className={`rounded-full px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 disabled:cursor-not-allowed disabled:opacity-60 ${
            t.numero === abierta ? "bg-tinta text-white" : "border border-tinta-suave/30 bg-white"
          }`}
        >
          Tarea {t.numero}
        </button>
      ))}
    </div>
  );
}
