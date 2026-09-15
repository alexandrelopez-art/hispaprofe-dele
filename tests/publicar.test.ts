import { describe, it, expect } from "vitest";
import { motivosParaNoPublicar, motivosParaPublicar, type TareaParaRevisar } from "@/lib/examen/publicar";

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
    expect(motivosParaNoPublicar("A2_B1_ESCOLAR", examenCompleto())).toEqual([]);
  });

  it("no deja publicar si falta una tarea", () => {
    const tareas = examenCompleto().filter(
      (t) => !(t.prueba === "CO" && t.numero === 3),
    );
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("CO");
    expect(motivos[0]).toContain("3");
  });

  it("no deja publicar si una tarea tiene los ítems que no son", () => {
    const tareas = examenCompleto().map((t) =>
      t.prueba === "CE" && t.numero === 4 ? { ...t, items: 6 } : t,
    );
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("7");
    expect(motivos[0]).toContain("6");
  });

  it("no deja publicar un examen vacío, y da un motivo por cada tarea que falta", () => {
    expect(motivosParaNoPublicar("A2_B1_ESCOLAR", [])).toHaveLength(14);
  });

  it("no deja publicar si sobra una tarea que el examen no tiene", () => {
    const tareas = [...examenCompleto(), { prueba: "CE" as const, numero: 5, items: 6 }];
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("no existe");
  });

  it("da los motivos en español, para que los lea el profesor", () => {
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", []);
    expect(motivos[0]).toMatch(/falta/i);
  });

  it("no deja publicar si a una tarea le sobran ítems", () => {
    const tareas = examenCompleto().map((t) =>
      t.prueba === "CO" && t.numero === 1 ? { ...t, items: 8 } : t,
    );
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("7");
    expect(motivos[0]).toContain("8");
  });

  it("no deja publicar si una tarea se coló dos veces", () => {
    const original = examenCompleto();
    const tareas = [...original, { ...original[0] }];
    const motivos = motivosParaNoPublicar("A2_B1_ESCOLAR", tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain(original[0].prueba);
    expect(motivos[0]).toContain(String(original[0].numero));
  });

  // Mutación que la mata: no mirar si el nivel tiene reglas (un examen de B2
  // se publicaría con las reglas de nadie, o reventaría).
  it("un nivel sin números no se publica", () => {
    const motivos = motivosParaNoPublicar("B2", examenCompleto());
    expect(motivos).toEqual(["Este nivel (B2) todavía no tiene sus números: no se puede publicar."]);
  });
});

describe("motivos para publicar desde el taller", () => {
  const todas = () =>
    [["CE", [6, 6, 6, 7]], ["CO", [7, 6, 6, 6]], ["EE", [0, 0]], ["EO", [0, 0, 0, 0]]].flatMap(([prueba, items]) =>
      (items as number[]).map((n, i) => ({ prueba: prueba as "CE" | "CO" | "EE" | "EO", numero: i + 1, items: n, completa: true })),
    );

  // Mutación que la mata: no mirar `completa`.
  it("una tarea a medias se nombra y no deja publicar", () => {
    const tareas = todas();
    tareas.find((t) => t.prueba === "CO" && t.numero === 1)!.completa = false;
    tareas.find((t) => t.prueba === "EO" && t.numero === 1)!.completa = false;
    expect(motivosParaPublicar("A2_B1_ESCOLAR", tareas)).toEqual(["Faltan por completar: CO1, EO1."]);
  });

  // Mutación que la mata: devolver [] sin llamar a motivosParaNoPublicar cuando están todas completas.
  it("con las 14 completas, manda la estructura", () => {
    expect(motivosParaPublicar("A2_B1_ESCOLAR", todas())).toEqual([]);
    const tareas = todas();
    tareas[0].items = 5;
    expect(motivosParaPublicar("A2_B1_ESCOLAR", tareas)).toEqual(["La tarea 1 de comprensión de lectura tiene que llevar 6 ítems y lleva 5."]);
  });
});
