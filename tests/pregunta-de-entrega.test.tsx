import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { TareaParaHacer } from "@/lib/examen/paraHacer";
import { sinResponderPorTarea } from "@/lib/examen/sin-responder";
import { PreguntaDeEntrega } from "@/components/examen/pregunta-de-entrega";

// Ayudante calcado de tests/examen-pantallas.test.tsx: construye una
// TareaParaHacer con formularioVacio y deja rellenar el formulario.
function tareaDe(numero: number, regla: ReglaTarea, rellenar: (f: Formulario) => void): TareaParaHacer {
  const formulario = formularioVacio(regla);
  rellenar(formulario);
  return { numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: [] };
}

// CE-1: RELACIONAR, items 1-6.
function t1(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 1)!;
  return tareaDe(1, regla, (f) => {
    if (f.forma !== "RELACIONAR") throw new Error("regla equivocada");
    f.consigna = "Relaciona cada mensaje con su texto.";
    f.actividad.ejemplo = { texto: "Texto del ejemplo", letra: "B" };
    f.actividad.elementos = f.actividad.elementos.map((e) => ({ ...e, texto: `Mensaje ${e.numero}` }));
    f.actividad.destinos = f.actividad.destinos.map((d) => ({ ...d, titulo: `Título ${d.letra}`, texto: `Texto ${d.letra}` }));
  });
}

// CE-2: LISTA_COMUN, items 7-12.
function t2(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 2)!;
  return tareaDe(2, regla, (f) => {
    if (f.forma !== "LISTA_COMUN") throw new Error("regla equivocada");
    f.consigna = "Lee los tres textos y contesta a las preguntas.";
    f.textos = [
      { etiqueta: "Persona 1", texto: "Texto 1" },
      { etiqueta: "Persona 2", texto: "Texto 2" },
      { etiqueta: "Persona 3", texto: "Texto 3" },
    ];
    f.actividad.comunes = [
      { letra: "A", texto: "Tienda A" },
      { letra: "B", texto: "Tienda B" },
      { letra: "C", texto: "Tienda C" },
    ];
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Enunciado de la ${p.numero}` }));
  });
}

function botonQueDice(html: string, texto: string): string {
  const m = html.match(new RegExp(`(<button[^>]*>)${texto}</button>`));
  expect(m, `no hay botón «${texto}»`).not.toBeNull();
  return m![1]!;
}

describe("sinResponderPorTarea", () => {
  // Mutación que la mata: contar como respondida una cadena vacía (el
  // servidor guarda "" al borrar), o listar las preguntas de todas las
  // tareas juntas sin decir de cuál son.
  it("dice, tarea a tarea, qué números faltan", () => {
    const falta = sinResponderPorTarea([t1(), t2()], {
      "1": "A", "2": "B", "3": "", "4": "C", "5": "A", "6": "B",
      "7": "A", "8": "B", "9": "C", "10": "A", "11": "B", "12": "C",
    });
    expect(falta).toEqual(["en la tarea 1 no has contestado la 3"]);
  });

  // Mutación que la mata: listar las seis una a una cuando no hay ninguna.
  it("una tarea entera en blanco se dice de una vez", () => {
    expect(sinResponderPorTarea([t1()], {})).toEqual(["no has contestado nada en la tarea 1"]);
  });

  // Mutación que la mata: juntar con «y».
  it("varias sueltas van con «ni»", () => {
    expect(sinResponderPorTarea([t2()], { "7": "A", "10": "B", "11": "C", "12": "A" })).toEqual([
      "en la tarea 2 no has contestado la 8 ni la 9",
    ]);
  });

  // Mutación que la mata: devolver algo con todo contestado.
  it("con todo contestado no falta nada", () => {
    const todo = Object.fromEntries([...Array(12)].map((_, i) => [String(i + 1), "A"]));
    expect(sinResponderPorTarea([t1(), t2()], todo)).toEqual([]);
  });
});

describe("PreguntaDeEntrega", () => {
  // Mutación que la mata: volver a window.confirm (no se viste ni se prueba),
  // o no pintar lo que falta.
  it("es un diálogo de la página que lista lo que falta", () => {
    const html = renderToStaticMarkup(
      <PreguntaDeEntrega
        abierta
        falta={["la tarea 1 está en blanco", "en la tarea 2 no has contestado la 8 ni la 9"]}
        enviando={false}
        textoSeguir="Seguir con la prueba"
        alSi={() => {}}
        alNo={() => {}}
      />,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain("Ojo:");
    expect(html).toContain("<li>la tarea 1 está en blanco</li>");
    expect(html).toContain("<li>en la tarea 2 no has contestado la 8 ni la 9</li>");
    expect(html).toContain("¿Entregar de todas formas?");
    expect(html).toContain("Sí, entregar");
    expect(html).toContain("Seguir con la prueba");
  });

  // Mutación que la mata: dejar el «Ojo:» con la lista vacía.
  it("sin nada pendiente solo avisa de que no se puede deshacer", () => {
    const html = renderToStaticMarkup(
      <PreguntaDeEntrega abierta falta={[]} enviando={false} textoSeguir="Seguir escribiendo" alSi={() => {}} alNo={() => {}} />,
    );
    expect(html).not.toContain("Ojo:");
    expect(html).toContain("Entregar no se puede deshacer.");
    expect(html).toContain("Seguir escribiendo");
  });

  // Mutación que la mata: no apagar «Sí, entregar» mientras envía (segundo
  // clic = segunda entrega), o no apagar «Seguir» mientras envía (el
  // componente le pasa disabled={enviando} a propósito: mientras la entrega
  // está en el aire, tampoco se vuelve a la prueba).
  it("mientras envía, «Sí, entregar» se apaga y dice que entrega", () => {
    const html = renderToStaticMarkup(
      <PreguntaDeEntrega abierta falta={[]} enviando textoSeguir="Seguir con la prueba" alSi={() => {}} alNo={() => {}} />,
    );
    expect(botonQueDice(html, "Entregando…")).toMatch(/\sdisabled=""/);
    expect(botonQueDice(html, "Seguir con la prueba")).toMatch(/\sdisabled=""/);
  });

  // Mientras se envía, Escape (el evento `cancel` del <dialog>) no puede
  // cerrar la pregunta: sin jsdom no hay forma de disparar ese evento de
  // verdad con renderToStaticMarkup (no ejecuta handlers), así que se lee el
  // fuente en vez de fingir una prueba que no prueba nada.
  // Mutación que la mata: quitar el onCancel del <dialog>, o quitarle la
  // guarda `if (enviando)` (dejaría cerrar con Escape aunque se esté enviando).
  it("el onCancel del dialogo bloquea el cierre solo mientras enviando (leido del fuente)", () => {
    const codigo = readFileSync("components/examen/pregunta-de-entrega.tsx", "utf8");
    const m = codigo.match(/onCancel=\{([\s\S]*?)\}\}/);
    expect(m, "no se encontro onCancel en el <dialog>").not.toBeNull();
    expect(m![1]).toContain("enviando");
    expect(m![1]).toMatch(/preventDefault\(\)/);
  });
});
