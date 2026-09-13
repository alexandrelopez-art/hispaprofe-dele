import { describe, it, expect } from "vitest";
import { alternarEtiqueta } from "@/lib/taller/etiquetas";
import { idsEnOrden, type EstadoDePagina } from "@/lib/taller/lista-de-subida";

const subida = (ficheroId: string): EstadoDePagina => ({ nombre: ficheroId, estado: "SUBIDA", ficheroId, error: null });

describe("la lista de subida", () => {
  // Mutación que la mata: ordenar por id o por llegada.
  it("da los ids en el orden de la lista, que es el del PDF", () => {
    expect(idsEnOrden([subida("f3"), subida("f1"), subida("f2")])).toEqual(["f3", "f1", "f2"]);
  });

  // Mutación que la mata: saltarse las que no han llegado en vez de devolver null.
  it("mientras falte una, no hay lista", () => {
    const fallida: EstadoDePagina = { nombre: "p2", estado: "FALLIDA", ficheroId: null, error: "Cortado" };
    expect(idsEnOrden([subida("f1"), fallida, subida("f3")])).toBeNull();
    expect(idsEnOrden([])).toBeNull();
  });
});

describe("alternar una etiqueta", () => {
  const TODAS = ["CE-1", "CE-2", "CE-3", "CE-4"];

  // Mutación que la mata: devolver `nuevas` sin filtrar por `todas`, perdiendo el orden del examen.
  it("pone y quita, y deja las etiquetas en el orden del examen", () => {
    expect(alternarEtiqueta(TODAS, ["CE-3"], "CE-2")).toEqual(["CE-2", "CE-3"]);
    expect(alternarEtiqueta(TODAS, ["CE-2", "CE-3"], "CE-2")).toEqual(["CE-3"]);
  });

  // Mutación que la mata: invertir el filtro final a `!nuevas.includes(e)`, dejando entrar lo que el examen no tiene.
  it("una etiqueta que el examen no tiene no entra", () => {
    expect(alternarEtiqueta(TODAS, [], "EO-9")).toEqual([]);
  });
});
