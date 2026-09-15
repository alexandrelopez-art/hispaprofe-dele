import { describe, it, expect } from "vitest";
import { reglaDe, type Forma } from "@/lib/dele/estructura";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";

type P = "CE" | "CO" | "EE" | "EO";
const vacio = (p: P, n: number) => formularioVacio(reglaDe("A2_B1_ESCOLAR", p, n)!);
const copia = <T,>(x: T): T => structuredClone(x);

/** Rellena cada texto vacío con "leído": lo que haría la IA en el caso feliz. */
function lleno(f: Formulario): Formulario {
  const rellenar = (x: unknown): unknown => {
    if (typeof x === "string") return x === "" ? "leído" : x;
    if (Array.isArray(x)) return x.map(rellenar);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "letra" ? v : rellenar(v)]));
    return x;
  };
  return rellenar(f) as Formulario;
}

const TAREAS: [P, number, Forma][] = [
  ["CE", 1, "RELACIONAR"], ["CE", 2, "LISTA_COMUN"], ["CE", 3, "OPCIONES"], ["CE", 4, "HUECOS"],
  ["CO", 1, "OPCIONES"], ["CO", 2, "RELACIONAR"], ["CO", 3, "LISTA_COMUN"], ["CO", 4, "OPCIONES"],
  ["EE", 1, "REDACCION_UNA"], ["EE", 2, "REDACCION_DOS"], ["EO", 1, "ORAL_SOLO"], ["EO", 2, "ORAL_DIRECTO"],
];

describe("imponer la estructura a lo que lee la IA", () => {
  // Mutación que la mata: devolver el vacío en vez de mezclar (los textos se pierden).
  it.each(TAREAS)("%s %i (%s): el caso feliz conserva los textos y cumple su forma", (p, n) => {
    const v = vacio(p, n);
    const r = imponerEstructura(v, lleno(v));
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("leído");
    expect(fallosDeForma(reglaDe("A2_B1_ESCOLAR", p, n)!, r.formulario)).toEqual([]);
  });

  // Mutación que la mata: quitar "numero" de las claves fijas.
  it("un número del libro cambiado por la IA vuelve al suyo", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[0].numero = 14;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas.map((q) => q.numero)).toEqual([13, 14, 15, 16, 17, 18]);
  });

  // Mutación que la mata: tomar la letra leída también cuando el vacío la trae puesta.
  it("una letra de opción cambiada vuelve a la suya", () => {
    const v = vacio("CE", 4);
    const leido = lleno(v);
    if (leido.forma !== "HUECOS") throw new Error();
    leido.actividad.huecos[0].opciones[2].letra = "D";
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "HUECOS") throw new Error();
    expect(r.formulario.actividad.huecos[0].opciones.map((o) => o.letra)).toEqual(["A", "B", "C"]);
  });

  // Mutación que la mata: quitar "conImagen" de las claves fijas.
  it("Auditiva 1: conImagen vuelve al del vacío", () => {
    const v = vacio("CO", 1);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[0].opciones[0].conImagen = false;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas[0].opciones[0].conImagen).toBe(true);
  });

  // Mutación que la mata: quitar "grupo" de las claves fijas.
  it("Auditiva 4: el grupo vuelve al del vacío", () => {
    const v = vacio("CO", 4);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[5].grupo = 1;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas[5].grupo).toBe(3);
  });

  // Mutación que la mata: recortar o rellenar la lista en vez de rechazar.
  it("una pregunta de menos se rechaza entera", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas.pop();
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 5 preguntas y la tarea tiene 6." });
  });

  // Mutación que la mata: comparar solo "menos" (leido.length < vacio.length).
  it("un texto suelto de más se rechaza entero", () => {
    const v = vacio("CE", 2);
    const leido = lleno(v);
    leido.textos.push({ etiqueta: "x", texto: "x" });
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 4 textos sueltos y la tarea tiene 3." });
  });

  // Mutación que la mata: no mirar las listas anidadas (opciones dentro de preguntas).
  it("una opción de menos en una pregunta se rechaza y dice dónde", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[2].opciones.pop();
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 2 opciones y la tarea tiene 3 (en actividad.preguntas.2)." });
  });

  // Mutación que la mata: quitar "pautas" de las listas libres.
  it("las pautas de más se aceptan", () => {
    const v = vacio("EE", 1);
    const leido = lleno(v);
    if (leido.forma !== "REDACCION_UNA") throw new Error();
    leido.actividad.pautas = ["uno", "dos", "tres", "cuatro"];
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "REDACCION_UNA") throw new Error();
    expect(r.formulario.actividad.pautas).toEqual(["uno", "dos", "tres", "cuatro"]);
  });

  // Mutación que la mata: imponer siempre la letra del vacío (la del ejemplo quedaría "").
  it("la letra del ejemplo se toma de la IA, en mayúscula y sola", () => {
    const v = vacio("CE", 1);
    const leido = lleno(v);
    if (leido.forma !== "RELACIONAR") throw new Error();
    leido.actividad.ejemplo.letra = " f ";
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "RELACIONAR") throw new Error();
    expect(r.formulario.actividad.ejemplo.letra).toBe("F");
  });

  // Mutación que la mata: tratar el ejemplo null como un null cualquiera (tomar el leído).
  it("si la tarea lleva ejemplo y la IA no lo leyó, se rechaza", () => {
    const v = vacio("CO", 3);
    const leido = lleno(v);
    if (leido.forma !== "LISTA_COMUN") throw new Error();
    leido.actividad.ejemplo = null;
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA no leyó el ejemplo." });
  });

  // Mutación que la mata: tomar siempre el null del vacío (los rangos quedarían vacíos).
  it("los rangos y la preparación se toman de la IA", () => {
    const v = vacio("EO", 1);
    const leido = lleno(v);
    if (leido.forma !== "ORAL_SOLO") throw new Error();
    leido.actividad.minutos = { min: 2, max: 3 };
    leido.actividad.preparacion = 15;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "ORAL_SOLO") throw new Error();
    expect(r.formulario.actividad.minutos).toEqual({ min: 2, max: 3 });
    expect(r.formulario.actividad.preparacion).toBe(15);
  });

  // Mutación que la mata: modificar `vacio` en sitio.
  it("no toca los objetos que recibe", () => {
    const v = vacio("CE", 3);
    const antes = copia(v);
    imponerEstructura(v, lleno(v));
    expect(v).toEqual(antes);
  });
});
