import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import {
  DUDA_DE_LA_CONSIGNA, claveDeRuta, dudasDelFormulario, quitarDudasDe, rutaDeClave, tieneAlgoEscrito,
} from "@/lib/taller/ia/dudas";

const ce3 = () => formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);

describe("las dudas de la IA", () => {
  // Mutación que la mata: dejar los índices como texto ("2" en vez de 2).
  it("una clave con índices se convierte en ruta con números", () => {
    expect(rutaDeClave("actividad.preguntas.2.enunciado")).toEqual(["actividad", "preguntas", 2, "enunciado"]);
    expect(claveDeRuta(["actividad", "preguntas", 2, "enunciado"])).toBe("actividad.preguntas.2.enunciado");
  });

  // Mutación que la mata: no filtrar (devolver todas las leídas).
  it("tira las dudas de campos que no existen y conserva las que sí", () => {
    const dudas = dudasDelFormulario(ce3(), [
      { campo: "actividad.preguntas.2.enunciado", nota: "borroso" },
      { campo: "actividad.preguntas.9.enunciado", nota: "no existe" },
      { campo: "actividad.preguntas", nota: "no es un campo" },
    ]);
    expect(dudas.map((d) => d.clave)).toEqual(["consigna", "actividad.preguntas.2.enunciado"]);
  });

  // Mutación que la mata: no añadir la duda fija de la consigna.
  it("la consigna va siempre, una sola vez, con su nota fija", () => {
    const dudas = dudasDelFormulario(ce3(), [{ campo: "consigna", nota: "de la IA" }]);
    expect(dudas).toEqual([DUDA_DE_LA_CONSIGNA]);
  });

  // Mutación que la mata: comparar solo la clave exacta (las pautas se editan como lista entera).
  it("editar un campo quita su duda y las de dentro, y deja las demás", () => {
    const dudas = [
      { clave: "actividad.pautas.1", nota: "a" },
      { clave: "actividad.pautasExtra", nota: "b" },
      { clave: "consigna", nota: "c" },
    ];
    expect(quitarDudasDe(dudas, ["actividad", "pautas"]).map((d) => d.clave)).toEqual(["actividad.pautasExtra", "consigna"]);
  });

  // Mutación que la mata: comparar con JSON.stringify (el orden de las claves daría "algo escrito").
  it("un formulario vacío con las claves en otro orden no tiene nada escrito", () => {
    const v = ce3();
    const reordenado = JSON.parse(JSON.stringify({ textos: v.textos, actividad: v.actividad, consigna: v.consigna, forma: v.forma }));
    expect(tieneAlgoEscrito(reordenado, v)).toBe(false);
  });

  // Mutación que la mata: devolver siempre false.
  it("con un texto puesto sí tiene algo escrito", () => {
    const v = ce3();
    expect(tieneAlgoEscrito({ ...v, consigna: "Lee." }, v)).toBe(true);
  });
});
