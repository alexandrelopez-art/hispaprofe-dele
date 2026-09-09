import { describe, it, expect } from "vitest";
import { motivosParaNoPublicar, type TareaParaRevisar } from "@/lib/examen/publicar";

/** Un examen entero y correcto: 4+4 tareas de opciones y las 6 abiertas. */
function examenCompleto(): TareaParaRevisar[] {
  return [
    { prueba: "CE", numero: 1, items: 6 },
    { prueba: "CE", numero: 2, items: 6 },
    { prueba: "CE", numero: 3, items: 6 },
    { prueba: "CE", numero: 4, items: 7 },
    { prueba: "CO", numero: 1, items: 7 },
    { prueba: "CO", numero: 2, items: 6 },
    { prueba: "CO", numero: 3, items: 6 },
    { prueba: "CO", numero: 4, items: 6 },
    { prueba: "EE", numero: 1, items: 0 },
    { prueba: "EE", numero: 2, items: 0 },
    { prueba: "EO", numero: 1, items: 0 },
    { prueba: "EO", numero: 2, items: 0 },
    { prueba: "EO", numero: 3, items: 0 },
    { prueba: "EO", numero: 4, items: 0 },
  ];
}

describe("la guarda de publicación", () => {
  it("deja publicar un examen completo y con los números buenos", () => {
    expect(motivosParaNoPublicar(examenCompleto())).toEqual([]);
  });

  it("no deja publicar si falta una tarea", () => {
    const tareas = examenCompleto().filter(
      (t) => !(t.prueba === "CO" && t.numero === 3),
    );
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("CO");
    expect(motivos[0]).toContain("3");
  });

  it("no deja publicar si una tarea tiene los ítems que no son", () => {
    const tareas = examenCompleto().map((t) =>
      t.prueba === "CE" && t.numero === 4 ? { ...t, items: 6 } : t,
    );
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("7");
    expect(motivos[0]).toContain("6");
  });

  it("no deja publicar un examen vacío, y da un motivo por cada tarea que falta", () => {
    expect(motivosParaNoPublicar([])).toHaveLength(14);
  });

  it("no deja publicar si sobra una tarea que el examen no tiene", () => {
    const tareas = [...examenCompleto(), { prueba: "CE" as const, numero: 5, items: 6 }];
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("no existe");
  });

  it("da los motivos en español, para que los lea el profesor", () => {
    const motivos = motivosParaNoPublicar([]);
    expect(motivos[0]).toMatch(/falta/i);
  });
});
