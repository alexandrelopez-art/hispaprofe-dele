// tests/ocr-formas-relacionar.test.ts
//
// RELACIONAR es la última forma y la más dura: aparece dos veces por examen y
// las dos veces son muy distintas (ver lib/taller/ocr/formas/relacionar.ts).
// Sigue la misma regla que el resto de tests/ocr-formas*.test.ts: sobrevivir
// al filtro que pasaría la IA (imponerEstructura + fallosDeForma) y, cuando
// el texto está demasiado roto para sacar un dato, dejar ese hueco vacío en
// vez de inventarlo. Los fixtures de tests/ayudas/ocr-formas/ son recortes
// reales del corpus (tres exámenes de CE-1, tres de CO-2), no texto inventado
// a propósito para que la prueba pase — y CE-1 se prueba a propósito en un
// examen limpio (2) y en dos caóticos (1 y 5), porque la dificultad de esta
// tarea depende muchísimo del examen.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import type { Prueba } from "@/lib/generated/prisma";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";
import { leerRelacionar } from "@/lib/taller/ocr/formas/relacionar";

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

describe("leerRelacionar — CE-1 (elementos con texto propio, destinos decorativos)", () => {
  it("examen 2 (destinos en cajas limpias): ejemplo y los seis elementos completos; 9/10 destinos con texto, solo G vacío", () => {
    const r = regla("CE", 1);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-ce1-examen2.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    // El relato del ejemplo (VERÓNICA) se recupera, aunque fundido con la columna
    // de nombres de al lado (la fila del ejemplo comparte maqueta con la lista "PERSONA").
    expect(f.actividad.ejemplo.texto).toContain("Tengo 12 años");
    // Sin tabla de respuestas ni frase "opción correcta" en esta tarea: la letra se deja vacía, no se adivina.
    expect(f.actividad.ejemplo.letra).toBe("");

    expect(f.actividad.elementos.map((e) => e.texto.length > 0)).toEqual([true, true, true, true, true, true]);
    expect(f.actividad.elementos[0].texto).toContain("Literatura");
    expect(f.actividad.elementos[3].texto).toContain("informática");
    expect(f.actividad.elementos[5].texto).toContain("Historia");

    const destinos = f.actividad.destinos;
    expect(destinos.map((d) => d.texto.length > 0)).toEqual([true, true, true, true, true, true, false, true, true, true]);
    expect(destinos[0].titulo).toBe("Historia de Sara");
    expect(destinos[0].texto).toContain("Ana Alonso");
    expect(destinos[1].titulo).toBe("Laberinto de juegos");
    // "Texto G" aparece sin cuerpo detrás (la maqueta salta directa a "Texto B" en la misma
    // página): se deja vacío en vez de inventar una reseña. Es la única letra que falla aquí.
    expect(destinos[6]).toEqual({ letra: "G", titulo: "", texto: "" });
    expect(destinos[9].titulo).toBe("365 enigmas y juegos de lógica");
  });

  it("examen 1 (anuncios decorativos, entrada rota/postal): 5/6 elementos limpios, uno vacío y uno fundido con su vecino; 9/10 destinos con texto", () => {
    const r = regla("CE", 1);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-ce1-examen1.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    expect(f.actividad.ejemplo.texto).toContain("hacer reportajes");

    // "3. LEILA: 6. PACO:" caen en la misma línea (maqueta a dos columnas): el elemento 3
    // se queda vacío en vez de inventar dónde corta, y el 6 se queda con las dos mitades
    // mezcladas línea a línea. Los otros cuatro se recuperan limpios.
    const elementos = f.actividad.elementos;
    expect(elementos[2].texto).toBe("");
    expect(elementos[5].texto).toContain("Todos mis amigos");
    expect(elementos[5].texto).toContain("guitarra"); // la mitad de LEILA se cuela en el bloque de PACO
    expect(elementos[0].texto).toContain("pequeñita");
    expect(elementos[1].texto).toContain("hermanos");
    expect(elementos[3].texto).toContain("piercing");
    expect(elementos[4].texto).toContain("moda");

    // "Texto G" vuelve a salir sin cuerpo (se repite en más de un examen: no es un caso suelto).
    const destinos = f.actividad.destinos;
    expect(destinos.map((d) => d.texto.length > 0)).toEqual([true, true, true, true, true, true, false, true, true, true]);
    expect(destinos[0].titulo).toBe("De armario en armario");
    expect(destinos[3].titulo).toBe("FOTOFESTÍN");
    expect(destinos[3].texto).toContain("inserción en la vida laboral");
    expect(destinos[6]).toEqual({ letra: "G", titulo: "", texto: "" });
    // "Texto |" (la "I" sale como una barra vertical) se reconoce igual.
    expect(destinos[8].texto).toContain("videojuegos de Zaragoza");
  });

  it("examen 5 (profesiones, maqueta a dos columnas fundida línea a línea): elementos limpios, pero solo la mitad de los destinos trae algo de texto", () => {
    const r = regla("CE", 1);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-ce1-examen5.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    // El lado de los seis jóvenes no tiene aquí el problema de columnas del examen 1: los
    // seis elementos se recuperan limpios (la maqueta rota está solo en el lado de los destinos).
    expect(f.actividad.elementos.map((e) => e.texto.length > 0)).toEqual([true, true, true, true, true, true]);
    expect(f.actividad.elementos[0].texto).toContain("ordenadores");

    // El lado de los destinos funde cada fila entera de dos columnas ("Texto A Texto B",
    // cuerpo intercalado línea a línea): la primera letra de cada pareja se queda vacía y la
    // segunda se queda con las dos mitades mezcladas. Es el peor caso medido: solo 5 de 10
    // destinos traen algo de texto, y ese texto no es limpio (mezcla el anuncio de al lado).
    const destinos = f.actividad.destinos;
    expect(destinos.map((d) => d.texto.length > 0)).toEqual([false, true, false, true, false, true, false, true, false, true]);
    expect(destinos[1].texto).toContain("enfermería"); // el bloque "B" carga con la mitad de "A" (auxiliar de enfermería) también
    expect(destinos[1].texto).toContain("camiones");
  });
});

describe("leerRelacionar — CO-2 (elementos sin texto, destinos en lista limpia)", () => {
  it("examen 1: los seis elementos son 'Mensaje N' sin texto (van por audio) y los diez enunciados se leen completos, con la letra del ejemplo", () => {
    const r = regla("CO", 2);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-co2-examen1.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    expect(f.actividad.elementos).toHaveLength(6);
    for (const e of f.actividad.elementos) expect(e.texto).toBe("");
    expect(f.actividad.ejemplo.texto).toBe("");
    // La frase fija "La opción correcta es la D." sí revela la letra del ejemplo.
    expect(f.actividad.ejemplo.letra).toBe("D");

    expect(f.actividad.destinos.map((d) => d.texto)).toEqual([
      "Se puede asistir a una actuación gratis.",
      "Anuncian algunas ofertas en sus servicios.",
      "Avisan sobre el retraso en la salida de un vuelo.",
      "Informan sobre el cierre de algunos colegios.",
      "Hay una fecha límite para los interesados en participar.",
      "Anuncian la inauguración de un restaurante.",
      "Dan algunas normas de uso.",
      "Dicen en qué estado se encuentran las instalaciones.",
      "Han comunicado el resultado de una selección.", // la "I." sale como "|." y se reconoce igual
      "Algunas personas no van a poder viajar donde querían.",
    ]);
  });

  it("examen 2 (opciones con paréntesis, 'I' confundida con el dígito '1'): los diez enunciados se leen completos", () => {
    const r = regla("CO", 2);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-co2-examen2.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    expect(f.actividad.ejemplo.letra).toBe("H");
    expect(f.actividad.destinos.map((d) => d.texto)).toEqual([
      "Ofrece una opción de comida rápida e informal.",
      "Anuncia un curso de psicología.",
      "Informa de la realización de actividades artísticas gratuitas.",
      "Ofrece descuentos si participas en grupo.",
      "Avisa de la inauguración de un punto de lectura.",
      "Puedes ganar un premio.",
      "Informan de que se van a realizar actividades de mantenimiento.",
      "Se realiza durante las vacaciones escolares.",
      "Es una escuela con mucha historia.", // "1) Es una escuela..." — el "1" es la "I"
      "Informa de la realización de corridas de toros.",
    ]);
  });

  it("examen 5: los diez enunciados se leen completos y la letra del ejemplo se recupera", () => {
    const r = regla("CO", 2);
    const f = mezclar(r, leerRelacionar(fixture("relacionar-co2-examen5.txt"), r));
    if (f.forma !== "RELACIONAR") throw new Error();

    expect(f.actividad.ejemplo.letra).toBe("B");
    expect(f.actividad.destinos.every((d) => d.texto.length > 0)).toBe(true);
    expect(f.actividad.destinos[3].texto).toBe("Da la posibilidad de conocer monumentos de distintos países sin salir de España.");
    expect(f.actividad.destinos[8].texto).toBe("Pone a la venta artículos nuevos y usados."); // "|. Pone..." — el pipe es la "I"
  });
});

describe("leerRelacionar — degradación con ruido", () => {
  it("CE-1 con puro ruido sin ninguna marca reconocible: todo vacío, nada inventado", () => {
    const r = regla("CE", 1);
    const f = mezclar(r, leerRelacionar("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "RELACIONAR") throw new Error();
    expect(f.actividad.ejemplo).toEqual({ texto: "", letra: "" });
    expect(f.actividad.elementos.every((e) => e.texto === "")).toBe(true);
    expect(f.actividad.destinos.every((d) => d.titulo === "" && d.texto === "")).toBe(true);
  });

  it("CO-2 con puro ruido sin ninguna marca reconocible: todo vacío, nada inventado", () => {
    const r = regla("CO", 2);
    const f = mezclar(r, leerRelacionar("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "RELACIONAR") throw new Error();
    expect(f.actividad.elementos.every((e) => e.texto === "")).toBe(true);
    expect(f.actividad.destinos.every((d) => d.texto === "")).toBe(true);
    expect(f.actividad.ejemplo).toEqual({ texto: "", letra: "" });
  });
});
