"use client";

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
// Un aviso que no es un error: algo que conviene saber antes de actuar (por
// ejemplo, que una corrección ya estaba firmada), no que algo haya ido mal.
// El rojo de AVISO_DE_ERROR ahí hace pensar que se ha roto algo.
export const AVISO_SUAVE = "rounded-2xl bg-sol-100 p-4";
