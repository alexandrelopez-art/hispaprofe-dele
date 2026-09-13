import { describe, it, expect } from "vitest";
import { cambiar } from "@/lib/taller/editar";

describe("cambiar un valor dentro del formulario", () => {
  const original = { consigna: "a", actividad: { preguntas: [{ enunciado: "uno" }, { enunciado: "dos" }] } };

  // Mutación que la mata: modificar el objeto en sitio (React no repintaría).
  it("devuelve una copia y deja el original como estaba", () => {
    const nuevo = cambiar(original, ["actividad", "preguntas", 1, "enunciado"], "DOS");
    expect(nuevo.actividad.preguntas[1].enunciado).toBe("DOS");
    expect(original.actividad.preguntas[1].enunciado).toBe("dos");
  });

  // Mutación que la mata: copiar también las ramas no tocadas (p.ej. `x.map((v) => ({ ...v }))` en vez de devolver `x` tal cual).
  it("lo que no se toca sigue siendo el mismo objeto", () => {
    const nuevo = cambiar(original, ["actividad", "preguntas", 1, "enunciado"], "DOS");
    expect(nuevo.actividad.preguntas[0]).toBe(original.actividad.preguntas[0]);
    expect(nuevo.consigna).toBe("a");
  });

  // Mutación que la mata: cambiar el texto de cualquiera de los dos mensajes de error (p.ej. quitar «se esperaba un índice»).
  it("una ruta que no casa con la forma avisa", () => {
    expect(() => cambiar(original, ["actividad", "preguntas", "primera"], "x")).toThrow("se esperaba un índice");
    expect(() => cambiar(original, ["consigna", "letra"], "x")).toThrow("no hay nada que cambiar");
  });
});
