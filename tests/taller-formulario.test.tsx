import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// El formulario importa la acción, y la acción la base: aquí no hay base.
vi.mock("@/app/examenes/acciones", () => ({ guardarTareaAccion: vi.fn(), rellenarTareaConIAAccion: vi.fn() }));

import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { FormularioDeTarea } from "@/components/taller/formulario-de-tarea";

const VACIA = { estado: "VACIA" as const, motivos: ["Sin guardar todavía."], imagenesPendientes: 0 };

function pintar(
  prueba: "CE" | "CO" | "EO",
  numero: number,
  respuestas: Record<string, string> | null,
  temas: string[] | null = null,
  hayClave = true,
  hayHojas = true,
) {
  const regla = reglaDe("A2_B1_ESCOLAR", prueba, numero)!;
  return renderToStaticMarkup(
    <FormularioDeTarea
      examenId="x1"
      prueba={prueba}
      numero={numero}
      regla={regla}
      inicial={formularioVacio(regla)}
      respuestas={respuestas}
      temasDeLaHermana={temas}
      estadoInicial={VACIA}
      hayClave={hayClave}
      hayHojas={hayHojas}
    />,
  );
}

describe("el formulario de una tarea", () => {
  // La respuesta del cuadernillo se enseña, pero no se edita: va en un <span>.
  // Mutación que la mata: pintar la respuesta en un <input>.
  it("Lectura 3 enseña la respuesta de cada pregunta, sin campo para editarla", () => {
    const html = pintar("CE", 3, { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" });
    for (const n of [13, 14, 15, 16, 17, 18]) expect(html).toContain(`<span data-respuesta="${n}"`);
    expect(html).toContain("Respuesta del cuadernillo: B");
    expect(html).not.toMatch(/<input[^>]*value="B"/);
  });

  // Mutación que la mata: cambiar el texto "Sin respuesta en el cuadernillo" en components/taller/campo.tsx.
  it("sin cuadernillo lo dice en cada pregunta", () => {
    expect(pintar("CE", 3, null)).toContain("Sin respuesta en el cuadernillo");
  });

  // Mutación que la mata: pintar un campo de texto también para las opciones con imagen.
  it("en Auditiva 1 las opciones con imagen dicen que se suben después", () => {
    const html = pintar("CO", 1, null);
    expect(html.match(/imagen: se sube en la Entrega 3/g)).toHaveLength(15);
  });

  // Mutación que la mata: quitar el prefijo "Va con: " en FormaOralDirecto (formas-abiertas.tsx).
  it("una oral en directo enseña el tema de su hermana al lado de cada opción", () => {
    const html = pintar("EO", 2, null, ["Las vacaciones", "El deporte"]);
    expect(html).toContain("Va con: Las vacaciones");
    expect(html).toContain("Va con: El deporte");
  });

  // Mutación que la mata: cambiar "Texto {d.letra}" por otro texto en FormaRelacionar (formas-cerradas.tsx).
  it("Lectura 1 tiene los diez textos de la A a la J", () => {
    const html = pintar("CE", 1, null);
    for (const letra of "ABCDEFGHIJ") expect(html).toContain(`Texto ${letra}`);
  });
});

describe("el botón de rellenar con IA", () => {
  // Mutación que la mata: no apagar el botón sin hojas.
  it("sin hojas etiquetadas sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, true, false);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Etiqueta primero las hojas de esta tarea.");
  });

  // Mutación que la mata: no apagar el botón sin clave.
  it("sin clave sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, false, true);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Falta la clave de la IA.");
  });

  // Mutación que la mata: dejarlo apagado siempre.
  it("con hojas y clave sale encendido y sin avisos", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html).toMatch(/<button[^>]*>Rellenar con IA<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA/);
    expect(html).not.toContain("Falta la clave de la IA.");
  });

  // Mutación que la mata: volver a poner el bloque del botón debajo del formulario.
  it("el botón va encima del formulario, antes de la consigna", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html.indexOf(">Rellenar con IA<")).toBeGreaterThan(-1);
    expect(html.indexOf("Consigna, ya corregida")).toBeGreaterThan(-1);
    expect(html.indexOf(">Rellenar con IA<")).toBeLessThan(html.indexOf("Consigna, ya corregida"));
  });
});
