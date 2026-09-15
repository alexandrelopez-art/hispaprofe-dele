import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { conMediosDe, cortesEnOrden, huecosDeImagen } from "@/lib/taller/medios";

const vacio = (p: "CE" | "CO" | "EO", n: number) => formularioVacio(reglaDe("A2_B1_ESCOLAR", p, n)!);

describe("los huecos de foto de una tarea", () => {
  // Mutación que la mata: olvidar las opciones del ejemplo.
  it("Auditiva 1: las tres del ejemplo y las tres de cada una de las cuatro primeras preguntas", () => {
    const h = huecosDeImagen(vacio("CO", 1));
    expect(h).toHaveLength(15);
    expect(h[0]).toEqual({ clave: "ejemplo-A", etiqueta: "la opción A del ejemplo" });
    expect(h.at(-1)).toEqual({ clave: "4-C", etiqueta: "la opción C de la pregunta 4" });
  });

  // Mutación que la mata: en ORAL_SOLO devolver un hueco por opción aunque no lleve conImagen.
  it("Oral 1 lleva una foto por opción y Oral 3 ninguna", () => {
    expect(huecosDeImagen(vacio("EO", 1))).toEqual([
      { clave: "opcion-1", etiqueta: "la opción 1" },
      { clave: "opcion-2", etiqueta: "la opción 2" },
    ]);
    expect(huecosDeImagen(vacio("EO", 3))).toEqual([]);
  });

  it("una tarea sin imágenes no tiene huecos", () => {
    expect(huecosDeImagen(vacio("CE", 3))).toEqual([]);
  });
});

describe("las marcas del audio", () => {
  // Mutación que la mata: comparar con > en vez de >= contra la separación mínima.
  it("en orden, positivas y a 0,3 s como poco", () => {
    expect(cortesEnOrden([])).toBe(true);
    expect(cortesEnOrden([10, 10.3, 42])).toBe(true);
    expect(cortesEnOrden([10, 10.2])).toBe(false);
    expect(cortesEnOrden([42, 10])).toBe(false);
    expect(cortesEnOrden([0])).toBe(false);
  });
});

describe("lo que la IA no toca", () => {
  // Mutación que la mata: devolver leido.medios en vez de enPantalla.medios.
  it("conMediosDe se queda con las fotos y la pista de la pantalla", () => {
    const pantalla = vacio("CO", 1);
    pantalla.medios = { imagenes: { "ejemplo-A": "f1" }, audio: { fichero: "a1", cortes: [30] } };
    const leido = { ...vacio("CO", 1), consigna: "Escucha." };
    const r = conMediosDe(leido, pantalla);
    expect(r.consigna).toBe("Escucha.");
    expect(r.medios).toEqual(pantalla.medios);
  });
});
