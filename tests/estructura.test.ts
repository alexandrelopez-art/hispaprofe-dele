import { describe, it, expect } from "vitest";
import { ESTRUCTURA, reglaDe } from "@/lib/dele/estructura";

describe("la estructura del A2/B1 escolar", () => {
  it("la comprensión de lectura son 4 tareas de 6, 6, 6 y 7 ítems", () => {
    expect(ESTRUCTURA.CE.map((r) => r.items)).toEqual([6, 6, 6, 7]);
  });

  it("la comprensión auditiva son 4 tareas de 7, 6, 6 y 6 ítems", () => {
    expect(ESTRUCTURA.CO.map((r) => r.items)).toEqual([7, 6, 6, 6]);
  });

  it("las dos pruebas de opciones suman 25 ítems cada una", () => {
    const suma = (p: "CE" | "CO") =>
      ESTRUCTURA[p].reduce((t, r) => t + (r.items ?? 0), 0);
    expect(suma("CE")).toBe(25);
    expect(suma("CO")).toBe(25);
  });

  it("la expresión escrita son 2 tareas de respuesta abierta", () => {
    expect(ESTRUCTURA.EE).toHaveLength(2);
    expect(ESTRUCTURA.EE.every((r) => r.items === null)).toBe(true);
  });

  it("la expresión oral son 4 tareas de respuesta abierta", () => {
    expect(ESTRUCTURA.EO).toHaveLength(4);
    expect(ESTRUCTURA.EO.every((r) => r.items === null)).toBe(true);
  });

  it("reglaDe devuelve null para una tarea que no existe", () => {
    expect(reglaDe("CE", 5)).toBeNull();
    expect(reglaDe("CE", 0)).toBeNull();
  });

  it("reglaDe devuelve la tarea 4 de lectura con sus 7 ítems", () => {
    expect(reglaDe("CE", 4)).toEqual({ numero: 4, items: 7 });
  });
});
