import { describe, it, expect } from "vitest";
import { motivoParaNoGuardar, sumaDeNotas } from "@/components/examen/notas";

const vacia = () => [null, null, null, null];

describe("la suma de las notas", () => {
  // Mutación que la mata: contar un null como 0 en el máximo, o calcular el
  // máximo con las notas puestas en vez de con todas.
  it("suma lo puesto y el máximo es 3 por criterio y tarea", () => {
    expect(sumaDeNotas({ 1: [3, 2, null, 1], 2: vacia() }, [1, 2])).toEqual({ suma: 6, maximo: 24 });
  });

  // Mutación que la mata: sumar solo la tarea abierta, o solo la primera.
  it("con todo puesto suma las dos tareas", () => {
    expect(sumaDeNotas({ 1: [3, 3, 3, 3], 2: [0, 1, 2, 3] }, [1, 2])).toEqual({ suma: 18, maximo: 24 });
  });
});

describe("el motivo para no guardar", () => {
  // Mutación que la mata: devolver null aunque falte una nota. Se firmaría una
  // tarea con huecos.
  it("una tarea con dos notas sin poner", () => {
    expect(motivoParaNoGuardar({ 1: [3, 3, 3, 3], 2: [1, null, 2, null] }, [1, 2])).toBe("Te faltan 2 notas en la tarea 2.");
  });

  // Mutación que la mata: el singular mal («1 notas»).
  it("una sola nota", () => {
    expect(motivoParaNoGuardar({ 1: [3, 3, 3, null], 2: [1, 1, 1, 1] }, [1, 2])).toBe("Te falta 1 nota en la tarea 1.");
  });

  // Mutación que la mata: nombrar solo la primera tarea con huecos, o contar
  // las faltantes de una sola tarea en vez de sumarlas todas.
  it("en las dos tareas", () => {
    expect(motivoParaNoGuardar({ 1: vacia(), 2: [1, null, 1, 1] }, [1, 2])).toBe("Te faltan 5 notas en las tareas 1 y 2.");
  });

  // Mutación que la mata: tratar el 0 como vacío. Un 0 es una nota válida.
  it("con todo puesto, también con ceros, no hay motivo", () => {
    expect(motivoParaNoGuardar({ 1: [0, 0, 0, 0], 2: [3, 0, 1, 2] }, [1, 2])).toBeNull();
  });
});
