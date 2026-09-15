import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import {
  DUDA_DE_LA_CONSIGNA, claveDeRuta, dudasDelFormulario, etiquetaDeDuda, quitarDudasDe, rutaDeClave, tieneAlgoEscrito,
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
  it("la consigna va siempre, una sola vez, aunque la IA no diga nada de ella", () => {
    const dudas = dudasDelFormulario(ce3(), []);
    expect(dudas).toEqual([DUDA_DE_LA_CONSIGNA]);
  });

  // M4: si la IA también duda de la consigna, su nota se funde tras la fija.
  // Mutación que la mata: descartar la duda de la IA sobre la consigna en vez de fundirla.
  it("una duda de la IA sobre la consigna se funde tras la nota fija", () => {
    const dudas = dudasDelFormulario(ce3(), [{ campo: "consigna", nota: "de la IA" }]);
    expect(dudas).toEqual([{ clave: "consigna", nota: `${DUDA_DE_LA_CONSIGNA.nota} · de la IA` }]);
  });

  // M3: la IA a veces antepone "formulario." (el nombre de la clave en el esquema) al campo.
  // Mutación que la mata: no quitar el prefijo "formulario." antes de comprobar el campo.
  it("quita el prefijo «formulario.» del campo antes de filtrar", () => {
    const dudas = dudasDelFormulario(ce3(), [{ campo: "formulario.actividad.preguntas.2.enunciado", nota: "borroso" }]);
    expect(dudas.map((d) => d.clave)).toEqual(["consigna", "actividad.preguntas.2.enunciado"]);
  });

  // M4: dos dudas del mismo campo se funden en una sola.
  // Mutación que la mata: quedarse solo con la última duda de un campo repetido.
  it("dos dudas del mismo campo se funden con sus notas unidas", () => {
    const dudas = dudasDelFormulario(ce3(), [
      { campo: "actividad.preguntas.2.enunciado", nota: "borroso" },
      { campo: "actividad.preguntas.2.enunciado", nota: "tachado" },
    ]);
    const d = dudas.find((x) => x.clave === "actividad.preguntas.2.enunciado");
    expect(d?.nota).toBe("borroso · tachado");
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
    const reordenado = JSON.parse(
      JSON.stringify({ textos: v.textos, actividad: v.actividad, consigna: v.consigna, forma: v.forma, medios: v.medios }),
    );
    expect(tieneAlgoEscrito(reordenado, v)).toBe(false);
  });

  // Mutación que la mata: devolver siempre false.
  it("con un texto puesto sí tiene algo escrito", () => {
    const v = ce3();
    expect(tieneAlgoEscrito({ ...v, consigna: "Lee." }, v)).toBe(true);
  });

  // M5: etiqueta legible de cada duda para la lista, a partir de su clave.
  describe("etiquetaDeDuda", () => {
    // Mutación que la mata: no reconocer "consigna" como caso propio.
    it("consigna", () => expect(etiquetaDeDuda("consigna")).toBe("Consigna"));

    // Mutación que la mata: no sumar 1 al índice de textos.
    it("textos.1.texto", () => expect(etiquetaDeDuda("textos.1.texto")).toBe("Texto 2"));

    // Mutación que la mata: no distinguir enunciado de otros campos de pregunta.
    it("actividad.preguntas.2.enunciado", () => expect(etiquetaDeDuda("actividad.preguntas.2.enunciado")).toBe("Pregunta 3 · enunciado"));

    // Mutación que la mata: no convertir el índice de la opción en letra.
    it("actividad.preguntas.2.opciones.1.texto", () => expect(etiquetaDeDuda("actividad.preguntas.2.opciones.1.texto")).toBe("Pregunta 3 · opción B"));

    // Mutación que la mata: confundir huecos con preguntas.
    it("actividad.huecos.0.opciones.2.texto", () => expect(etiquetaDeDuda("actividad.huecos.0.opciones.2.texto")).toBe("Hueco 1 · opción C"));

    // Mutación que la mata: no reconocer las pautas de una opción (EO/EE).
    it("actividad.opciones.0.pautas.1", () => expect(etiquetaDeDuda("actividad.opciones.0.pautas.1")).toBe("Opción 1 · pauta 2"));

    // Mutación que la mata: dejar los puntos o los índices en base cero en el caso genérico.
    it("cualquier otra clave: índices en base uno y puntos por « · »", () => {
      expect(etiquetaDeDuda("actividad.destinos.4.titulo")).toBe("actividad · destinos · 5 · titulo");
    });
  });
});
