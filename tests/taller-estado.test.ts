import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import {
  claveDelFormulario,
  estadoDeTarea,
  imagenesPendientes,
  motivosDeTarea,
} from "@/lib/taller/estado";

const regla = (prueba: "CE" | "CO" | "EE" | "EO", numero: number) => reglaDe("A2_B1_ESCOLAR", prueba, numero)!;

/** Rellena todos los textos vacíos con «algo», menos las letras. */
function rellenar<T>(valor: T, clave = ""): T {
  if (typeof valor === "string") return (valor === "" && clave !== "letra" ? "algo" : valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => rellenar(v)) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, rellenar(v, k)])) as T;
  }
  return valor;
}

function lleno(prueba: "CE" | "CO" | "EE" | "EO", numero: number): Formulario {
  const f = rellenar(formularioVacio(regla(prueba, numero)));
  if (f.forma === "RELACIONAR") f.actividad.ejemplo.letra = "D";
  if ((f.forma === "LISTA_COMUN" || f.forma === "OPCIONES") && f.actividad.ejemplo) f.actividad.ejemplo.letra = "B";
  if (f.forma === "HUECOS") f.actividad.texto = "Uno [19] dos [20] tres [21] cuatro [22] cinco [23] seis [24] siete [25].";
  return f;
}

const CE3 = { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" };
const CE1 = { "1": "A", "2": "B", "3": "C", "4": "E", "5": "F", "6": "G" };

describe("una tarea completa", () => {
  // Mutación que la mata: devolver A_MEDIAS siempre.
  it("Lectura 3 llena y con su cuadernillo está completa", () => {
    expect(estadoDeTarea(regla("CE", 3), lleno("CE", 3), CE3, null)).toEqual({
      estado: "COMPLETA", motivos: [], imagenesPendientes: 0,
    });
  });

  // Mutación que la mata: en falta(), invertir vacio(valor) a !vacio(valor).
  it("una escrita llena está completa sin cuadernillo", () => {
    expect(estadoDeTarea(regla("EE", 1), lleno("EE", 1), null, null).estado).toBe("COMPLETA");
  });

  // Mutación que la mata: cambiar `if (!f)` por `if (f)` en estadoDeTarea.
  it("sin guardar, la tarea está vacía", () => {
    expect(estadoDeTarea(regla("CE", 3), null, CE3, null).estado).toBe("VACIA");
  });
});

describe("lo que falta", () => {
  // Mutación que la mata: quitar el trim() en vacio (comparar con `s === ""`).
  it("la consigna vacía es un motivo", () => {
    const f = lleno("CE", 3);
    f.consigna = "  ";
    expect(motivosDeTarea(regla("CE", 3), f, CE3, null)).toEqual(["Falta la consigna."]);
  });

  // Mutación que la mata: en OPCIONES, usar el índice del array en vez de p.numero en el mensaje.
  it("un enunciado vacío dice de qué pregunta es", () => {
    const f = lleno("CE", 3);
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas[2].enunciado = "";
    expect(motivosDeTarea(regla("CE", 3), f, CE3, null)).toEqual(["Falta el enunciado de la 15."]);
  });

  // Mutación que la mata: exigir texto a las opciones con imagen.
  it("una opción con imagen no necesita texto, y cuenta como imagen pendiente", () => {
    const f = lleno("CO", 1);
    if (f.forma !== "OPCIONES") throw new Error();
    for (const p of f.actividad.preguntas) for (const o of p.opciones) if (o.conImagen) o.texto = "";
    const respuestas = { "1": "A", "2": "B", "3": "C", "4": "A", "5": "B", "6": "C", "7": "A" };
    expect(motivosDeTarea(regla("CO", 1), f, respuestas, null)).toEqual([]);
    expect(imagenesPendientes(f)).toBe(15);
  });

  // Mutación que la mata: exigir texto a los elementos de Auditiva 2.
  it("en Auditiva 2 los mensajes no llevan texto", () => {
    const f = formularioVacio(regla("CO", 2));
    if (f.forma !== "RELACIONAR") throw new Error();
    f.consigna = "algo";
    f.actividad.ejemplo.letra = "D";
    f.actividad.destinos = f.actividad.destinos.map((d) => ({ ...d, texto: "algo" }));
    const respuestas = { "8": "A", "9": "B", "10": "C", "11": "E", "12": "F", "13": "G" };
    expect(motivosDeTarea(regla("CO", 2), f, respuestas, null)).toEqual([]);
  });

  // Mutación que la mata: en pautasVacias, usar pautas.every(vacio) en vez de pautas.some(vacio).
  it("una pauta vacía es un motivo", () => {
    const f = lleno("EO", 3);
    if (f.forma !== "ORAL_SOLO") throw new Error();
    f.actividad.opciones[1].pautas.push("");
    expect(motivosDeTarea(regla("EO", 3), f, null, null)).toEqual(["Hay una pauta vacía en la opción 2."]);
  });
});

describe("las respuestas del cuadernillo", () => {
  // Mutación que la mata: quitar el mensaje "Falta el cuadernillo..." cuando respuestas es null.
  it("sin cuadernillo, una tarea cerrada no está completa", () => {
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), null, null)).toEqual([
      "Falta el cuadernillo, o no trae las respuestas de este examen.",
    ]);
  });

  // Mutación que la mata: no mirar si cada número tiene respuesta.
  it("una respuesta que no está se dice por su número", () => {
    const { "16": _, ...sinLa16 } = CE3;
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), sinLa16, null)).toEqual([
      "El cuadernillo no trae la respuesta de la 16.",
    ]);
  });

  // Mutación que la mata: quitar la comprobación de letras posibles.
  it("una letra que la pregunta no tiene", () => {
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), { ...CE3, "13": "D" }, null)).toEqual([
      "La respuesta de la 13 es «D», y esa pregunta solo tiene A, B y C.",
    ]);
  });

  // Mutación que la mata: no quitar la letra del ejemplo de las posibles.
  it("en relacionar, la letra del ejemplo no puede ser respuesta", () => {
    expect(motivosDeTarea(regla("CE", 1), lleno("CE", 1), { ...CE1, "3": "D" }, null)).toEqual([
      "La respuesta de la 3 es «D», que es la del ejemplo.",
    ]);
  });

  // Mutación que la mata: no buscar letras repetidas en relacionar.
  it("en relacionar, dos preguntas con la misma letra", () => {
    expect(motivosDeTarea(regla("CE", 1), lleno("CE", 1), { ...CE1, "5": "B" }, null)).toEqual([
      "Las preguntas 2 y 5 tienen la misma respuesta, «B».",
    ]);
  });

  // Mutación que la mata: en claveDelFormulario, no filtrar por `numeros` (copiar todas las respuestas).
  it("la clave solo lleva los números de la tarea", () => {
    const todas = { ...CE1, ...CE3, "19": "A" };
    expect(claveDelFormulario(lleno("CE", 3), todas)).toEqual(CE3);
    expect(claveDelFormulario(lleno("EE", 1), todas)).toBeNull();
    expect(claveDelFormulario(lleno("CE", 3), null)).toBeNull();
  });

  // Mutación que la mata: no comparar la clave guardada.
  it("una clave guardada que ya no coincide pide volver a guardar", () => {
    const aviso = "La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.";
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, CE3)).toEqual([]);
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, { ...CE3, "13": "A" })).toEqual([aviso]);
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, {})).toEqual([aviso]);
  });
});

describe("las marcas de los huecos", () => {
  const CE4 = { "19": "A", "20": "B", "21": "C", "22": "A", "23": "B", "24": "C", "25": "A" };

  // Mutación que la mata: quitar motivosDeMarcas.
  it("una marca que falta, una repetida y una que sobra", () => {
    const f = lleno("CE", 4);
    if (f.forma !== "HUECOS") throw new Error();
    f.actividad.texto = "Uno [19] dos [19] tres [21] cuatro [22] cinco [23] seis [24] siete [25] ocho [26].";
    expect(motivosDeTarea(regla("CE", 4), f, CE4, null)).toEqual([
      "La marca [19] aparece 2 veces en el texto.",
      "Falta la marca [20] en el texto.",
      "El texto tiene una marca [26] que no es de ningún hueco.",
    ]);
  });

  // Mutación que la mata: quitar el guard de texto vacío al principio de motivosDeMarcas.
  it("con el texto vacío solo se dice que falta el texto", () => {
    const f = lleno("CE", 4);
    if (f.forma !== "HUECOS") throw new Error();
    f.actividad.texto = "";
    expect(motivosDeTarea(regla("CE", 4), f, CE4, null)).toEqual(["Falta el texto con los huecos."]);
  });
});
