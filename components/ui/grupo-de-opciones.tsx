export type OpcionDeGrupo = { valor: string; texto: string };

const FOCO = "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hp-600";

/**
 * Elegir UNA opción entre varias, con radios de verdad: las flechas del
 * teclado, el foco y el lector de pantalla los da el navegador gratis.
 *
 * `valor = null` es «ninguna marcada», que NO es lo mismo que la primera
 * opción: en las notas de corregir, un 0 es una nota y un hueco es una nota
 * que falta.
 *
 * Controlado si llega `alCambiar` (corregir); si no, lo lleva el formulario
 * con `valorInicial` (asignar, que se envía a una acción de servidor).
 */
export function GrupoDeOpciones({
  nombre,
  leyenda,
  opciones,
  forma = "lista",
  valor,
  alCambiar,
  valorInicial,
  disabled,
  ayuda,
}: {
  nombre: string;
  leyenda: string;
  opciones: OpcionDeGrupo[];
  forma?: "lista" | "segmentos";
  valor?: string | null;
  alCambiar?: (valor: string) => void;
  valorInicial?: string;
  disabled?: boolean;
  ayuda?: string;
}) {
  const controlado = alCambiar !== undefined;
  const marca = (o: OpcionDeGrupo) =>
    controlado
      ? { checked: valor === o.valor, onChange: () => alCambiar(o.valor) }
      : { defaultChecked: valorInicial === o.valor };

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2 disabled:opacity-60">
      <legend className="text-sm font-bold">{leyenda}</legend>
      {ayuda && <p data-ayuda className="text-sm text-tinta-suave">{ayuda}</p>}
      {forma === "segmentos" ? (
        <div className="inline-flex self-start overflow-hidden rounded-2xl border border-hp-300 bg-white">
          {opciones.map((o) => (
            <label key={o.valor} htmlFor={`${nombre}-${o.valor}`} className="relative">
              <input type="radio" id={`${nombre}-${o.valor}`} name={nombre} value={o.valor} className="peer sr-only" {...marca(o)} />
              <span
                className={`block min-w-11 cursor-pointer border-l border-hp-300 px-3 py-2 text-center font-bold text-hp-600 first:border-l-0 hover:bg-hp-50 peer-checked:bg-hp-700 peer-checked:text-white ${FOCO}`}
              >
                {o.texto}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {opciones.map((o) => (
            <label key={o.valor} htmlFor={`${nombre}-${o.valor}`} className="flex items-start gap-2">
              <input
                type="radio"
                id={`${nombre}-${o.valor}`}
                name={nombre}
                value={o.valor}
                className="mt-1 size-4 accent-hp-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600"
                {...marca(o)}
              />
              <span>{o.texto}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
