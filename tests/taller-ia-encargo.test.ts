import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { descripcionDeLaForma, encargoDeTarea, esquemaDeRespuesta, sinMedios, type Hoja } from "@/lib/taller/ia/encargo";

const HOJA_A: Hoja = { datos: "AAAA", tipo: "image/jpeg" };
const HOJA_B: Hoja = { datos: "BBBB", tipo: "image/png" };
const regla = (p: "CE" | "CO" | "EE" | "EO", n: number) => reglaDe("A2_B1_ESCOLAR", p, n)!;

describe("el encargo que se manda a la IA", () => {
  // Si el bloque fijo cambia entre tareas, la caché de la API no acierta nunca.
  // Mutación que la mata: meter el nombre de la tarea en las instrucciones fijas.
  it("las instrucciones fijas son idénticas byte a byte entre dos tareas distintas", () => {
    const a = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 1), [HOJA_A]);
    const b = encargoDeTarea("A2_B1_ESCOLAR", "EO", regla("EO", 2), [HOJA_B]);
    expect(a.system).toBe(b.system);
  });

  // Mutación que la mata: no incluir el formulario vacío en el texto.
  it("el texto lleva qué tarea es y su formulario vacío en JSON", () => {
    const e = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), [HOJA_A]);
    expect(e.texto).toContain("comprensión de lectura, tarea 3, A2/B1 escolar");
    expect(e.texto).toContain(JSON.stringify(sinMedios(formularioVacio(regla("CE", 3))), null, 2));
    expect(e.forma).toBe("OPCIONES");
  });

  // Mutación que la mata: ordenar las hojas o quedarse solo con la primera.
  it("las hojas van en el orden en que llegan", () => {
    expect(encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), [HOJA_B, HOJA_A]).hojas).toEqual([HOJA_B, HOJA_A]);
  });

  // Mutación que la mata: quitar la regla de no poner respuestas de las instrucciones.
  it("las instrucciones prohíben poner respuestas y explican las dudas", () => {
    const { system } = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), []);
    expect(system).toContain("No marques ni deduzcas respuestas correctas");
    expect(system).toContain("actividad.preguntas.2.enunciado");
  });

  // Mutación que la mata: devolver la misma descripción para todas las formas.
  it("cada forma se describe con sus números", () => {
    expect(descripcionDeLaForma(regla("CE", 1))).toBe("un ejemplo, 6 elementos (del 1 al 6) con su texto y 10 textos con letra (A-J), de los que sobran 4");
    expect(descripcionDeLaForma(regla("CO", 2))).toBe("un ejemplo, 6 elementos (del 8 al 13) sin texto, que son «Mensaje 1» a «Mensaje 6», y 10 textos con letra (A-J), que son los enunciados, de los que sobran 4");
    expect(descripcionDeLaForma(regla("CE", 2))).toBe("3 textos sueltos, uno por persona con su nombre en «etiqueta»; una lista común de 3 opciones (A-C); 6 preguntas (del 7 al 12)");
    expect(descripcionDeLaForma(regla("CO", 3))).toBe("una lista común de 3 opciones (A-C); un ejemplo; 6 preguntas (del 14 al 19)");
    expect(descripcionDeLaForma(regla("CE", 3))).toBe("un texto largo; 6 preguntas (del 13 al 18) con 3 opciones cada una (A-C)");
    expect(descripcionDeLaForma(regla("CO", 1))).toBe("un ejemplo; 7 preguntas (del 1 al 7) con 3 opciones cada una (A-C); las opciones del ejemplo y de las 4 primeras preguntas son dibujos");
    expect(descripcionDeLaForma(regla("CO", 4))).toBe("6 preguntas (del 20 al 25) con 3 opciones cada una (A-C); en 3 grupos de 2 preguntas");
    expect(descripcionDeLaForma(regla("CE", 4))).toBe("un texto con 7 huecos (del 19 al 25), cada uno con 3 opciones (A-C)");
    expect(descripcionDeLaForma(regla("EE", 1))).toBe("una situación, el texto recibido si lo hay, las pautas y el número de palabras");
    expect(descripcionDeLaForma(regla("EE", 2))).toBe("dos opciones, cada una con título, contexto y pautas, y el número de palabras");
    expect(descripcionDeLaForma(regla("EO", 1))).toBe("dos opciones, cada una con su tema y sus pautas, y cada una lleva una foto; los minutos y la preparación");
    expect(descripcionDeLaForma(regla("EO", 3))).toBe("dos opciones, cada una con su tema y sus pautas; los minutos y la preparación");
    expect(descripcionDeLaForma(regla("EO", 2))).toBe("dos opciones de conversación con el examinador, cada una con tema, situación, papel del examinador y pautas; los minutos");
  });

  // Mutación que la mata: usar la unión entera en vez del esquema de la forma.
  it("el esquema de respuesta es el de la forma y rechaza otra forma", () => {
    const esquema = esquemaDeRespuesta("HUECOS");
    const huecos = formularioVacio(regla("CE", 4));
    const otra = formularioVacio(regla("CE", 3));
    expect(esquema.safeParse({ formulario: sinMedios(huecos), dudas: [] }).success).toBe(true);
    expect(esquema.safeParse({ formulario: sinMedios(otra), dudas: [] }).success).toBe(false);
  });

  // Mutación que la mata: z.object en vez de z.strictObject en las dudas.
  it("una duda con un campo de más rebota", () => {
    const esquema = esquemaDeRespuesta("HUECOS");
    const huecos = formularioVacio(regla("CE", 4));
    expect(esquema.safeParse({ formulario: sinMedios(huecos), dudas: [{ campo: "consigna", nota: "x", seguro: false }] }).success).toBe(false);
  });
});

describe("la IA no ve las fotos ni la pista", () => {
  const co1 = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;

  // Mutación que la mata: quitar el .omit({ medios: true }) del esquema de respuesta.
  it("el esquema de respuesta rechaza un formulario con medios y acepta uno sin ellos", () => {
    const esquema = esquemaDeRespuesta("OPCIONES");
    expect(esquema.safeParse({ formulario: formularioVacio(co1), dudas: [] }).success).toBe(false);
    expect(esquema.safeParse({ formulario: sinMedios(formularioVacio(co1)), dudas: [] }).success).toBe(true);
  });

  // Mutación que la mata: mandar formularioVacio(regla) sin quitarle medios.
  it("el formulario vacío que se le manda no lleva medios", () => {
    expect(encargoDeTarea("A2_B1_ESCOLAR", "CO", co1, []).texto).not.toContain("medios");
  });
});
