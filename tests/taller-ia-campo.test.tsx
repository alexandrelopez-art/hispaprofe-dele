import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Campo, Numero, Pautas } from "@/components/taller/campo";
import { DudasContext } from "@/components/taller/dudas";

const nada = () => {};

describe("un campo con duda de la IA", () => {
  // Mutación que la mata: no leer el contexto en Campo.
  it("pinta la nota de su duda", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["actividad.titulo", "no se lee la tilde"]])}>
        <Campo etiqueta="Título" valor="Canción" alCambiar={nada} ruta={["actividad", "titulo"]} opcional />
      </DudasContext.Provider>,
    );
    expect(html).toContain('data-duda="actividad.titulo"');
    expect(html).toContain("La IA duda: no se lee la tilde");
    expect(html).toContain("bg-sol-100");
  });

  // Mutación que la mata: pintar la duda de cualquier campo (no comparar la clave).
  it("un campo sin duda no pinta ninguna, aunque otro la tenga", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["consigna", "retocada"]])}>
        <Campo etiqueta="Título" valor="Canción" alCambiar={nada} ruta={["actividad", "titulo"]} opcional />
      </DudasContext.Provider>,
    );
    expect(html).not.toContain("data-duda");
    expect(html).not.toContain("bg-sol-100");
  });

  // Mutación que la mata: pasar a cada pauta la ruta de la lista y no [...ruta, i].
  it("cada pauta mira su propia duda", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["actividad.pautas.1", "cortada"]])}>
        <Pautas etiqueta="Pautas" pautas={["una", "dos"]} alCambiar={nada} ruta={["actividad", "pautas"]} />
      </DudasContext.Provider>,
    );
    expect(html.match(/data-duda=/g)).toHaveLength(1);
    expect(html).toContain('data-duda="actividad.pautas.1"');
  });

  // Mutación que la mata: dejar fija la clase del <input> de Numero, sin mirar la duda.
  it("un Numero con duda se pinta en amarillo", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["actividad.preparacion", "no se lee el número"]])}>
        <Numero etiqueta="Minutos de preparación" valor={5} alCambiar={nada} ruta={["actividad", "preparacion"]} />
      </DudasContext.Provider>,
    );
    expect(html).toContain('data-duda="actividad.preparacion"');
    expect(html).toContain("bg-sol-100");
  });

  // Mutación que la mata: pintar bg-sol-100 aunque no haya duda.
  it("un Numero sin duda no se pinta en amarillo", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map()}>
        <Numero etiqueta="Minutos de preparación" valor={5} alCambiar={nada} ruta={["actividad", "preparacion"]} />
      </DudasContext.Provider>,
    );
    expect(html).not.toContain("bg-sol-100");
  });
});
