// tests/ocr-formas-ee-eo.test.ts
//
// Los lectores de las tareas de expresión escrita y oral (lib/taller/ocr/formas/redaccion.ts
// y oral.ts) siguen la misma regla que los de tests/ocr-formas.test.ts: sobrevivir al filtro
// que pasaría la IA (imponerEstructura + fallosDeForma) y, cuando el texto está demasiado roto
// para sacar un dato, dejar ese hueco vacío en vez de inventarlo. Los fixtures de
// tests/ayudas/ocr-formas/ son recortes reales del corpus (dos exámenes completos de EE y EO,
// tal como llegarían de páginas que comparten más de una tarea), no texto inventado a propósito
// para que la prueba pase.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import type { Prueba } from "@/lib/generated/prisma";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";
import { leerRedaccionDos, leerRedaccionUna } from "@/lib/taller/ocr/formas/redaccion";
import { leerOralDirecto, leerOralSolo } from "@/lib/taller/ocr/formas/oral";

const CARPETA_FIXTURES = path.join(process.cwd(), "tests", "ayudas", "ocr-formas");
const fixture = (nombre: string): string => readFileSync(path.join(CARPETA_FIXTURES, nombre), "utf-8");
const regla = (prueba: Prueba, numero: number): ReglaTarea => reglaDe("A2_B1_ESCOLAR", prueba, numero)!;

/** Comprueba que `leido` sobrevive el mismo filtro que pasaría lo que devuelve la IA, y devuelve el resultado ya mezclado. */
function mezclar(r: ReglaTarea, leido: Formulario): Formulario {
  const resultado = imponerEstructura(formularioVacio(r), leido);
  if ("error" in resultado) throw new Error(`imponerEstructura falló: ${resultado.error}`);
  const fallos = fallosDeForma(r, resultado.formulario);
  expect(fallos).toEqual([]);
  return resultado.formulario;
}

describe("leerRedaccionUna", () => {
  it("EE-1 examen 1 (correo con la pierna escayolada, cliente de correo con 'RESPONDER'): situación, mensaje, pautas y palabras", () => {
    const r = regla("EE", 1);
    const f = mezclar(r, leerRedaccionUna(fixture("ee-redaccion-examen1.txt"), r));
    if (f.forma !== "REDACCION_UNA") throw new Error();
    expect(f.actividad.situacion).toContain("pierna escayolada");
    expect(f.actividad.textoRecibido).toContain("Cuéntame si hay alguna novedad");
    expect(f.actividad.textoRecibido).toContain("Tu compa Emejota");
    // La tarea 2 (REDACCION_DOS), que comparte hoja con esta, no se cuela en el mensaje recibido.
    expect(f.actividad.textoRecibido).not.toContain("Elige solo una de las dos opciones");
    expect(f.actividad.pautas).toEqual([
      "saludar,",
      "interesarte por su salud,",
      "contarle alguna anécdota sobre las clases, profesores o compañeros,",
      "decirle qué día puedes ir a su casa,",
      "despedirte.",
    ]);
    expect(f.actividad.palabras).toEqual({ min: 60, max: 70 });
  });

  it("EE-1 examen 2 (correo sobre el viaje a Argentina, con basura de interfaz '[LAek:)' delante del saludo): se recupera igual", () => {
    const r = regla("EE", 1);
    const f = mezclar(r, leerRedaccionUna(fixture("ee-redaccion-examen2.txt"), r));
    if (f.forma !== "REDACCION_UNA") throw new Error();
    expect(f.actividad.situacion).toContain("viaje a Argentina");
    expect(f.actividad.textoRecibido).toContain("Aconséjame");
    expect(f.actividad.textoRecibido).toContain("Alberto");
    expect(f.actividad.pautas).toEqual([
      "saludar,",
      "dar ánimos y algún consejoa a tu amigo,",
      "intentar convencerle de que sería bueno para él hacer el viaje y explicarle el motivo,",
      "despedirte.",
    ]);
    expect(f.actividad.palabras).toEqual({ min: 60, max: 70 });
  });

  it("texto sin ninguna marca reconocible: pautas y palabras vacías en vez de inventadas", () => {
    const r = regla("EE", 1);
    const f = mezclar(r, leerRedaccionUna("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "REDACCION_UNA") throw new Error();
    expect(f.actividad.textoRecibido).toBe("");
    expect(f.actividad.pautas).toEqual([]);
    expect(f.actividad.palabras).toEqual({ min: null, max: null });
  });
});

describe("leerRedaccionDos", () => {
  it("EE-2 examen 1 (extraescolares / abismo generacional; el número de palabras llega corrupto como 'no')", () => {
    const r = regla("EE", 2);
    const f = mezclar(r, leerRedaccionDos(fixture("ee-redaccion-examen1.txt"), r));
    if (f.forma !== "REDACCION_DOS") throw new Error();
    expect(f.consigna).toContain("Elige solo una de las dos opciones");
    expect(f.actividad.opciones[0].contexto).toContain("actividades extraescolares");
    expect(f.actividad.opciones[0].pautas).toEqual([
      "de qué actividad se trataba,",
      "con qué frecuencia la hacías,",
      "qué es lo que más te gustaba y por qué,",
      "alguna anécdota que sucedió durante alguna de las sesiones.",
    ]);
    expect(f.actividad.opciones[1].contexto).toContain("abismo generacional");
    expect(f.actividad.opciones[1].pautas).toHaveLength(5);
    // "Número de palabras recomendado: entre no y 130." — "no" es una corrupción OCR de "110": no se adivina.
    expect(f.actividad.palabras).toEqual({ min: null, max: 130 });
  });

  it("EE-2 examen 2 (solidaridad / alimentación; números de palabras limpios)", () => {
    const r = regla("EE", 2);
    const f = mezclar(r, leerRedaccionDos(fixture("ee-redaccion-examen2.txt"), r));
    if (f.forma !== "REDACCION_DOS") throw new Error();
    expect(f.consigna).toContain("Elige sólo una de las dos opciones");
    expect(f.actividad.opciones[0].contexto).toContain("mercado solidario");
    expect(f.actividad.opciones[0].pautas).toEqual([
      "decir por qué crees que tu idea puede tener éxito,",
      "comentar qué beneficios puede aportar a las personas,",
      "contar si has participado ya en proyectos de este tipo,",
      "hablar de lo importante que es ayudar a los demás.",
    ]);
    expect(f.actividad.opciones[1].contexto).toContain("trastornos en la alimentación");
    expect(f.actividad.opciones[1].pautas).toHaveLength(4);
    expect(f.actividad.palabras).toEqual({ min: 110, max: 130 });
  });

  it("texto sin ninguna marca reconocible: las dos opciones y las palabras quedan vacías", () => {
    const r = regla("EE", 2);
    const f = mezclar(r, leerRedaccionDos("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "REDACCION_DOS") throw new Error();
    for (const o of f.actividad.opciones) expect(o.pautas).toEqual([]);
    expect(f.actividad.opciones[1]).toEqual({ titulo: "", contexto: "", pautas: [] });
    expect(f.actividad.palabras).toEqual({ min: null, max: null });
  });
});

describe("leerOralSolo", () => {
  it("EO-1 examen 2 (describir una foto, dos opciones completas): tema, seis pautas por opción y minutos en palabras", () => {
    const r = regla("EO", 1);
    const f = mezclar(r, leerOralSolo(fixture("eo-oral-examen2.txt"), r));
    if (f.forma !== "ORAL_SOLO") throw new Error();
    expect(f.actividad.opciones[0].tema).toBe("EL REGALO PERFECTO");
    expect(f.actividad.opciones[0].pautas).toHaveLength(6);
    expect(f.actividad.opciones[0].pautas[1]).toBe("¿Dónde están esas personas? ¿Cómo es ese lugar? ¿Qué objetos hay?");
    expect(f.actividad.opciones[1].tema).toBe("PREPARANDO EL EXAMEN DE MAÑANA");
    expect(f.actividad.opciones[1].pautas).toHaveLength(6);
    // "durante uno o dos minutos", en palabras, no en cifras.
    expect(f.actividad.minutos).toEqual({ min: 1, max: 2 });
    // Los minutos de preparación viven en la introducción compartida de la prueba oral, que no
    // llega en estas dos páginas de la tarea 1: se deja en null, no se adivina el "12" de al lado.
    expect(f.actividad.preparacion).toBeNull();
  });

  it("EO-1 examen 3 (solo 'COMEDOR ESCOLAR' llega en esta hoja; una pregunta sin su viñeta se funde con la anterior)", () => {
    const r = regla("EO", 1);
    const f = mezclar(r, leerOralSolo(fixture("eo-oral-examen3.txt"), r));
    if (f.forma !== "ORAL_SOLO") throw new Error();
    // El bloque encontrado se coloca por orden de aparición, no por el número de "(OPCIÓN N)"
    // (que en este examen, para la tarea 1, ni siquiera está: ver el propio fixture): el único
    // bloque de la tarea 1 que trae esta hoja cae en la posición 0.
    expect(f.actividad.opciones[0].tema).toBe("COMEDOR ESCOLAR");
    // "¿En qué lugar crees que se encuentran?" y la siguiente línea, sin viñeta ("Qué objetos
    // aparecen en la fotografía?"), se recuperan las dos pero fundidas en una sola pauta.
    expect(f.actividad.opciones[0].pautas).toEqual([
      "¿Qué crees que hacen las personas que aparecen en la foto?",
      "¿En qué lugar crees que se encuentran? Qué objetos aparecen en la fotografía?",
      "¿Cómo son las personas de la foto? Describe a alguna de ellas.",
      "¿Qué relación hay entre ellos?",
    ]);
    // La otra opción ("FIESTA DE CUMPLEAÑOS") está en otra página que no llegó en este recorte:
    // se deja vacía en vez de rellenarla con la de al lado.
    expect(f.actividad.opciones[1].tema).toBe("");
    expect(f.actividad.opciones[1].pautas).toEqual([]);
  });

  it("EO-3 examen 3 (presentar un tema, títulos con interrogación; 'No olvides:' no contamina la última pauta)", () => {
    const r = regla("EO", 3);
    const f = mezclar(r, leerOralSolo(fixture("eo-oral-examen3.txt"), r));
    if (f.forma !== "ORAL_SOLO") throw new Error();
    expect(f.actividad.opciones[0].tema).toBe("¿CUÁL ES TU CIUDAD FAVORITA?");
    expect(f.actividad.opciones[0].pautas).toHaveLength(7);
    expect(f.actividad.opciones[0].pautas.some((p) => p.includes("No olvides"))).toBe(false);
    expect(f.actividad.opciones[1].tema).toBe("¿CUÁL ES EL MEJOR ESPECTÁCULO AL QUE HAS 1DO?");
    expect(f.actividad.opciones[1].pautas).toHaveLength(7);
    // "Tendrás que hablar durante dos o tres minutos."
    expect(f.actividad.minutos).toEqual({ min: 2, max: 3 });
  });

  it("texto sin ninguna marca reconocible: temas, pautas y minutos vacíos en vez de inventados", () => {
    const r = regla("EO", 1);
    const f = mezclar(r, leerOralSolo("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "ORAL_SOLO") throw new Error();
    for (const o of f.actividad.opciones) {
      expect(o.tema).toBe("");
      expect(o.pautas).toEqual([]);
    }
    expect(f.actividad.minutos).toEqual({ min: null, max: null });
    expect(f.actividad.preparacion).toBeNull();
  });
});

describe("leerOralDirecto", () => {
  it("EO-2 examen 2 (diálogo simulado, dos opciones): tema, situación separada del papel del examinador y pautas", () => {
    const r = regla("EO", 2);
    const f = mezclar(r, leerOralDirecto(fixture("eo-oral-examen2.txt"), r));
    if (f.forma !== "ORAL_DIRECTO") throw new Error();
    expect(f.actividad.opciones[0].tema).toBe("EL REGALO PERFECTO");
    expect(f.actividad.opciones[0].situacion).toBe(
      "Dentro de un par de semanas es el cumpleaños de tu mejor amigo, que es un apasionado de los animales.",
    );
    expect(f.actividad.opciones[0].papelExaminador).toContain("El examinador es el amigo que va a cumplir años");
    expect(f.actividad.opciones[0].pautas).toHaveLength(5);
    expect(f.actividad.opciones[1].tema).toBe("PREPARANDO EL EXAMEN DE MAÑANA");
    expect(f.actividad.opciones[1].pautas).toHaveLength(5);
    // Los minutos de esta tarea solo se dicen en la introducción compartida de la prueba oral,
    // que no llega en estas páginas: null, no un valor adivinado de la tarea 1 o 3 de al lado.
    expect(f.actividad.minutos).toEqual({ min: null, max: null });
  });

  it("EO-4 examen 2 (entrevista; la opción 2 se pierde entera porque el OCR deja 'TAREA Ll.' en vez de 'TAREA 4.')", () => {
    const r = regla("EO", 4);
    const f = mezclar(r, leerOralDirecto(fixture("eo-oral-examen2.txt"), r));
    if (f.forma !== "ORAL_DIRECTO") throw new Error();
    expect(f.actividad.opciones[0].tema).toBe("TUS MEJORES VACACIONES");
    // Más de 12 preguntas reales en la hoja: el esquema tope a 12 (`pautas` en formas.ts) y se recortan.
    expect(f.actividad.opciones[0].pautas.length).toBeLessThanOrEqual(12);
    expect(f.actividad.opciones[0].pautas[0]).toBe("¿Siempre vas de vacaciones con tu familia?");
    // "TAREA Ll." no coincide con ningún número de tarea reconocible: la segunda opción
    // ("LAS REDES SOCIALES") no se rescata. Limitación real y documentada, no un dato inventado.
    expect(f.actividad.opciones[1]).toEqual({ tema: "", situacion: "", papelExaminador: "", pautas: [] });
  });

  it("EO-4 examen 3 (entrevista con dos opciones limpias): las preguntas se separan por '¿...?' y el cierre fijo no contamina la última", () => {
    const r = regla("EO", 4);
    const f = mezclar(r, leerOralDirecto(fixture("eo-oral-examen3.txt"), r));
    if (f.forma !== "ORAL_DIRECTO") throw new Error();
    expect(f.actividad.opciones[0].tema).toBe("¿CUÁL ES TU CIUDAD FAVORITA?");
    expect(f.actividad.opciones[0].pautas[0]).toBe("¿Has viajado mucho en tu vida?");
    expect(f.actividad.opciones[0].pautas.some((p) => p.includes("entrevistador también puede solicitar"))).toBe(false);
    expect(f.actividad.opciones[1].tema).toBe("¿CUÁL ES EL MEJOR ESPECTÁCULO AL QUE HAS IDO?");
    expect(f.actividad.opciones[1].pautas[0]).toBe("¿Qué tipo de espectáculos te gusta?");
    expect(f.actividad.opciones[1].pautas.some((p) => p.includes("entrevistador también puede solicitar"))).toBe(false);
  });

  it("texto sin ninguna marca reconocible: temas, situación, papel del examinador y pautas vacíos", () => {
    const r = regla("EO", 2);
    const f = mezclar(r, leerOralDirecto("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "ORAL_DIRECTO") throw new Error();
    for (const o of f.actividad.opciones) {
      expect(o.tema).toBe("");
      expect(o.situacion).toBe("");
      expect(o.papelExaminador).toBe("");
      expect(o.pautas).toEqual([]);
    }
    expect(f.actividad.minutos).toEqual({ min: null, max: null });
  });
});
