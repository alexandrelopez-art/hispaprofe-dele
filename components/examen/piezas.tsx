"use client";

import Link from "next/link";
import type { TareaParaHacer } from "@/lib/examen/paraHacer";

/**
 * Las piezas que comparten las pantallas del examen: la lectura y la auditiva
 * (`hacer-prueba.tsx`) y la escrita (`hacer-escrita.tsx`).
 *
 * Viven aquí y no en una de las dos pantallas porque, mientras vivieron en
 * `hacer-prueba.tsx`, las dos se importaban la una a la otra: hacer-prueba
 * necesitaba `HacerEscrita` para encaminar y hacer-escrita necesitaba estas
 * piezas. Ese círculo funcionaba, pero lo sostenía una costumbre que nada
 * vigila —que nadie leyera estas constantes en el nivel superior del módulo—:
 * el día que alguien escribiera `const X = CAJA + "…"` fuera de una función,
 * reventaría con «Cannot access 'CAJA' before initialization», y solo entrando
 * por una de las dos puertas. Un tercer fichero que no importa a ninguno de los
 * dos no tiene ese filo.
 */

export const CAJA = "flex min-w-0 flex-col gap-4 rounded-2xl border border-tinta-suave/20 bg-white p-5";
export const BOTON = "self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50";
export const BOTON_SUAVE = "self-start rounded-2xl border border-tinta-suave/30 px-6 py-3 font-bold disabled:opacity-50";
export const AVISO_DE_ERROR = "rounded-2xl bg-error-100 p-4 text-error-600";

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
          className={`rounded-full px-4 py-2 font-bold disabled:opacity-50 ${t.numero === abierta ? "bg-hp-400 text-white" : "border border-tinta-suave/30"}`}
        >
          Tarea {t.numero}
        </button>
      ))}
    </div>
  );
}

/**
 * La salida. Sin esto la pantalla del examen es un callejón: no hay cabecera
 * común en el sitio, así que al terminar la lectura no había forma de volver
 * a Inicio para empezar la auditiva más que con el botón de atrás del
 * navegador. Lo cazó el profesor en la aceptación, no las pruebas.
 *
 * Va en las cuatro caras de las tres pruebas, también mientras se hace una con
 * reloj: lo que NO se puede hacer es irse creyendo que el reloj se para, y por
 * eso ahí lo dice. Es un enlace y no un formulario porque no cambia nada: las
 * respuestas ya están guardadas en el servidor según se marcan, y el borrador
 * de la escrita se descarga al desmontar esta pantalla (ver `useBorradores`).
 */
export function VolverAInicio({ haciendoConReloj }: { haciendoConReloj: boolean }) {
  return (
    <p>
      <Link href="/" className="text-hp-600 underline">
        ← Volver a Inicio
      </Link>
      {haciendoConReloj && (
        <span className="ml-2 text-sm text-tinta-suave">El reloj sigue corriendo.</span>
      )}
    </p>
  );
}
