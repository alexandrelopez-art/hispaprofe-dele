// tests/ocr-formas.test.ts
//
// Los lectores de OCR (lib/taller/ocr/formas/*.ts) no tienen que acertar
// letra por letra: tienen que sobrevivir al mismo filtro que pasaría la IA
// (imponerEstructura + fallosDeForma) y, cuando el texto está demasiado roto
// para sacar un dato, dejar ese hueco vacío en vez de inventarlo. Los
// fixtures de tests/ayudas/ocr-formas/ son recortes reales del corpus (ver
// el encargo original), no texto inventado a propósito para que la prueba
// pase.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import type { Prueba } from "@/lib/generated/prisma";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";
import { leerHuecos } from "@/lib/taller/ocr/formas/huecos";
import { leerListaComun } from "@/lib/taller/ocr/formas/lista-comun";
import { leerOpciones } from "@/lib/taller/ocr/formas/opciones";

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

describe("leerOpciones", () => {
  it("Lectura 3 (paréntesis, con texto de lectura y opción C corrupta de varias formas): estructura correcta y prosa recuperada", () => {
    const r = regla("CE", 3);
    const f = mezclar(r, leerOpciones(fixture("ce3-opciones.txt"), r));
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.consigna).toContain("Vas a leer un fragmento");
    expect(f.textos[0].etiqueta).toBe("EL DIARIO NARANJA DE CARLOTA");
    expect(f.textos[0].texto).toContain("Ana, la tutora");
    expect(f.textos[0].texto).not.toContain("Adaptado de");
    expect(f.actividad.preguntas).toHaveLength(6);
    expect(f.actividad.preguntas[0].enunciado).toBe("La tutora, según el texto...");
    expect(f.actividad.preguntas[0].opciones.map((o) => o.texto)).toEqual([
      "trabaja en la secretaría del centro.",
      "es también profesora de lengua.",
      "organiza las tutorías mensualmente.", // la "C)" llegó como "(" suelto
    ]);
    // El enunciado de la 18 se parte en dos líneas en el OCR ("...inmigrante y\nemigrante..."): se recompone.
    expect(f.actividad.preguntas[5].enunciado).toBe("Según el texto, los conceptos inmigrante y emigrante...");
    expect(f.actividad.preguntas[5].opciones.map((o) => o.texto)).toEqual([
      "son una cuestión de gramática.",
      "son sinónimos.",
      "se diferencian por la dirección de la migración.", // "Q" en vez de "C)"
    ]);
  });

  it("Lectura 3 con puntos en vez de paréntesis y sin la consigna ni el texto en el recorte: huecos vacíos, no inventados", () => {
    const r = regla("CE", 3);
    const f = mezclar(r, leerOpciones(fixture("ce3-opciones-puntos.txt"), r));
    if (f.forma !== "OPCIONES") throw new Error();
    // Este recorte no trae ni la consigna ni el texto de lectura: no se inventan.
    expect(f.consigna).toBe("");
    expect(f.textos[0]).toEqual({ etiqueta: "", texto: "" });
    expect(f.actividad.preguntas[0].enunciado).toBe("Cuando era joven, Juan Gris.");
    expect(f.actividad.preguntas[0].opciones.map((o) => o.texto)).toEqual([
      "vendía revistas en Madrid.",
      "trabajaba en diversas publicaciones.",
      "copiaba a los pintores modernistas.",
    ]);
    expect(f.actividad.preguntas[5].opciones.map((o) => o.texto)).toEqual([
      "fue famoso desde muy joven.",
      "tiene mucha presencia en museos franceses.",
      "fue reconocido tras su muerte.",
    ]);
  });

  it("Auditiva 1 (ejemplo con imágenes y dos cabeceras de conversación fundidas en una línea): las preguntas se recuperan igual", () => {
    const r = regla("CO", 1);
    const f = mezclar(r, leerOpciones(fixture("co1-opciones.txt"), r));
    if (f.forma !== "OPCIONES") throw new Error();
    // El ejemplo es solo imágenes: ni el enunciado ni las opciones se pueden leer del OCR ("A B [a", "eu"...).
    expect(f.actividad.ejemplo).not.toBeNull();
    expect(f.actividad.ejemplo?.opciones.every((o) => o.texto === "")).toBe(true);
    // Pero la frase fija del cuadernillo sí revela la letra correcta del ejemplo.
    expect(f.actividad.ejemplo?.letra).toBe("B");
    expect(f.actividad.preguntas).toHaveLength(7);
    // "CONVERSACIÓN 1 CONVERSACIÓN 3" cae en una sola línea (maqueta a dos columnas):
    // no se puede saber qué pregunta es de cuál, pero las 4 preguntas con imagen
    // se recuperan igual porque se buscan directamente por "¿...?", no por su cabecera.
    expect(f.actividad.preguntas.slice(0, 4).map((p) => p.enunciado)).toEqual([
      "¿Qué han decidido regalarle a su madre?",
      "¿Quién es el nuevo profesor de Matemáticas?",
      "¿Cómo van a volver a casa las dos amigas?",
      "¿Qué taller elige para sus hijos?",
    ]);
    expect(f.actividad.preguntas.slice(0, 4).every((p) => p.opciones.every((o) => o.texto === ""))).toBe(true);
    // Las tres últimas, sin imagen, sí traen sus opciones (con la C corrupta como "Q").
    expect(f.actividad.preguntas[6].enunciado).toBe("¿A qué lugar van a entrar?");
    expect(f.actividad.preguntas[6].opciones.map((o) => o.texto)).toEqual([
      "A una tienda de alimentación.",
      "A un cine antiguo.",
      "A una academia.",
    ]);
    expect(f.actividad.preguntas[4].opciones.map((o) => o.texto)).toEqual([
      "Fránces.",
      "Ninguna.",
      "Educación plástica y visual.",
    ]);
  });

  it("Auditiva 4 (tres grupos de noticias, números de ítem a veces corruptos): las seis preguntas y sus opciones se recuperan", () => {
    const r = regla("CO", 4);
    const f = mezclar(r, leerOpciones(fixture("co4-opciones-grupos.txt"), r));
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.actividad.preguntas).toHaveLength(6);
    expect(f.actividad.preguntas[0].opciones.map((o) => o.texto)).toEqual([
      "hasta los 18 años.",
      "con cualquier edad.",
      "a partir de los 8 años.",
    ]);
    // "22," en vez de "22.": sigue anclando la pregunta igual.
    expect(f.actividad.preguntas[2].enunciado).toBe("En Monterrey, según la audición, se hicieron campamentos de verano...");
    expect(f.actividad.preguntas[2].opciones.map((o) => o.texto)).toEqual([
      "en diferentes parques públicos.",
      "en los museos de la ciudad.",
      "en todas sus bibliotecas públicas.",
    ]);
    // Marca de la C sin ningún signo de puntuación ("C también...").
    expect(f.actividad.preguntas[5].opciones.map((o) => o.texto)).toEqual([
      "muestra la importancia del voluntariado para el equilibrio del planeta.",
      "recibirá a miles de niños de hasta 7 años.",
      "también enseña la manera de navegar en alta mar.",
    ]);
  });

  it("texto sin ninguna marca reconocible: preguntas vacías en vez de inventadas", () => {
    const r = regla("CE", 3);
    const f = mezclar(r, leerOpciones("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.textos[0]).toEqual({ etiqueta: "", texto: "" });
    expect(f.actividad.preguntas).toHaveLength(6);
    for (const p of f.actividad.preguntas) {
      expect(p.enunciado).toBe("");
      expect(p.opciones.map((o) => o.texto)).toEqual(["", "", ""]);
    }
  });
});

describe("leerListaComun", () => {
  it("Lectura 2 (tres relatos con cabecera de nombre): comunes y textos sueltos correctos, y la pregunta partida en dos líneas queda vacía", () => {
    const r = regla("CE", 2);
    const f = mezclar(r, leerListaComun(fixture("ce2-lista-comun.txt"), r));
    if (f.forma !== "LISTA_COMUN") throw new Error();
    expect(f.actividad.comunes.map((c) => c.texto)).toEqual(["ANIKO", "CARLOS", "PATRICIA"]);
    expect(f.textos.map((t) => t.etiqueta)).toEqual(["ANIKO", "CARLOS", "PATRICIA"]);
    expect(f.textos[0].texto).toContain("Un amigo de Barcelona");
    expect(f.textos[1].texto).toContain("Tengo 30 años");
    expect(f.textos[2].texto).toContain("Desde que nací, en el 87");
    expect(f.textos.every((t) => !t.texto.includes("Adaptado de"))).toBe(true);
    expect(f.actividad.preguntas).toHaveLength(6);
    expect(f.actividad.preguntas.slice(0, 5).map((p) => p.enunciado)).toEqual([
      "¿Quién ha necesitado estar más en forma para recorrer el mundo?",
      "¿A quién no le importó dejar un empleo para viajar?",
      "¿A quién le resultó más difícil dar el primer paso?",
      "¿Quién se marchó con algo de dinero que tenía?",
      "¿Quién cambió su modo de viajar?",
    ]);
    // La sexta pregunta llega partida por el OCR en "¿Qu" + "n lleva menos tiempo viajando?":
    // ninguno de los dos fragmentos es una pregunta reconocible, así que se deja en blanco.
    expect(f.actividad.preguntas[5].enunciado).toBe("");
  });

  it("Auditiva 3 (tabla sin cabeceras de texto, con ejemplo y números muy corruptos): la lista común sale de la consigna", () => {
    const r = regla("CO", 3);
    const f = mezclar(r, leerListaComun(fixture("co3-lista-comun.txt"), r));
    if (f.forma !== "LISTA_COMUN") throw new Error();
    expect(f.actividad.comunes.map((c) => c.texto)).toEqual(["Adriana", "Miguel", "ninguno de los dos"]);
    // Sin textos con cabecera de nombre en esta tarea (es de audición: regla.textos es 0).
    expect(f.textos).toEqual([]);
    expect(f.actividad.ejemplo).not.toBeNull();
    expect(f.actividad.ejemplo?.enunciado).toBe("Tiene que estudiar para los exámenes.");
    // No hay frase "opción correcta es la X" en esta tarea (usa una marca "Xx" en la tabla,
    // que no dice de qué columna es): la letra del ejemplo se deja vacía, no se adivina.
    expect(f.actividad.ejemplo?.letra).toBe("");
    // Los números reales van de "10./4./5./6./7./8./119." pero el orden alcanza para las 6 preguntas.
    expect(f.actividad.preguntas.map((p) => p.enunciado)).toEqual([
      "Quizás cambie de planes al final.",
      "Le van a pagar por ocuparse de alguien.",
      "No ha suspendido ninguna asignatura.",
      "Está libre una semana.",
      "Estuvo en Irlanda el año pasado.",
      "A finales de agosto va a descansar.",
    ]);
  });

  it("texto sin ninguna marca reconocible: comunes, textos y preguntas vacíos en vez de inventados", () => {
    const r = regla("CE", 2);
    const f = mezclar(r, leerListaComun("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "LISTA_COMUN") throw new Error();
    expect(f.actividad.comunes.every((c) => c.texto === "")).toBe(true);
    expect(f.textos).toEqual([{ etiqueta: "", texto: "" }, { etiqueta: "", texto: "" }, { etiqueta: "", texto: "" }]);
    expect(f.actividad.preguntas.every((p) => p.enunciado === "")).toBe(true);
  });
});

describe("leerHuecos", () => {
  it("Lectura 4 (título en mayúsculas, un número de contenido real -150- que no debe confundirse con un hueco)", () => {
    const r = regla("CE", 4);
    const f = mezclar(r, leerHuecos(fixture("ce4-huecos.txt"), r));
    if (f.forma !== "HUECOS") throw new Error();
    expect(f.actividad.titulo).toBe("EN PIE DE GUERRA: ¿PERIODISTA O ESCRITOR?");
    for (let n = 19; n <= 25; n++) expect(f.actividad.texto).toContain(`[${n}]`);
    // "150 estudiantes" es contenido real del texto, no un hueco: no se marca.
    expect(f.actividad.texto).toContain("150 estudiantes");
    expect(f.actividad.texto).not.toContain("[15]");
    expect(f.actividad.fuente).toContain("Adaptado de");
    expect(f.actividad.huecos).toHaveLength(7);
    expect(f.actividad.huecos[0].opciones.map((o) => o.texto)).toEqual(["más que", "más de", "más"]);
    // Ejemplo con las tres opciones capitalizadas (empiezan la frase) y la marca de C es "O".
    expect(f.actividad.huecos[3].opciones.map((o) => o.texto)).toEqual(["Era", "Había", "Estaba"]);
    expect(f.actividad.huecos[6].opciones.map((o) => o.texto)).toEqual(["comprendió", "supe", "realicé"]);
  });

  it("Lectura 4 (título en minúscula normal, huecos separados por guiones bajos): se localiza igual por su posición", () => {
    const r = regla("CE", 4);
    const f = mezclar(r, leerHuecos(fixture("ce4-huecos-vocacion.txt"), r));
    if (f.forma !== "HUECOS") throw new Error();
    expect(f.actividad.titulo).toBe("Tres maneras de descubrir tu vocación");
    for (let n = 19; n <= 25; n++) expect(f.actividad.texto).toContain(`[${n}]`);
    expect(f.actividad.huecos[0].opciones.map((o) => o.texto)).toEqual(["siempre", "alguna vez", "nunca"]);
    // "Qsi" funde la marca de C con la palabra siguiente sin espacio: no se distingue el
    // corte con confianza, así que la opción C se deja vacía en vez de adivinar dónde corta.
    expect(f.actividad.huecos[3].opciones.map((o) => o.texto)).toEqual(["que", "qué Qsi", ""]);
  });

  it("Lectura 4 (marca de opción pegada a la palabra siguiente, «(es» y «A)a»): se separan igual", () => {
    const r = regla("CE", 4);
    const f = mezclar(r, leerHuecos(fixture("ce4-huecos-refrescos.txt"), r));
    if (f.forma !== "HUECOS") throw new Error();
    expect(f.actividad.titulo).toBe("REFRESCOS CASEROS");
    for (let n = 19; n <= 25; n++) expect(f.actividad.texto).toContain(`[${n}]`);
    expect(f.actividad.huecos[0].opciones.map((o) => o.texto)).toEqual(["están", "son", "es"]);
    expect(f.actividad.huecos[5].opciones.map((o) => o.texto)).toEqual(["a", "con", "para"]);
  });

  it("texto sin ninguna marca reconocible: título, texto y huecos vacíos en vez de inventados", () => {
    const r = regla("CE", 4);
    const f = mezclar(r, leerHuecos("ruido total sin ninguna marca reconocible aqui mismo", r));
    if (f.forma !== "HUECOS") throw new Error();
    expect(f.actividad.titulo).toBe("");
    expect(f.actividad.texto).toBe("");
    expect(f.actividad.fuente).toBe("");
    expect(f.actividad.huecos).toHaveLength(7);
    for (const h of f.actividad.huecos) expect(h.opciones.map((o) => o.texto)).toEqual(["", "", ""]);
  });
});
