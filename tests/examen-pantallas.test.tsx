import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { TareaParaHacer } from "@/lib/examen/paraHacer";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";

function tareaDe(numero: number, regla: ReglaTarea, rellenar: (f: Formulario) => void): TareaParaHacer {
  const formulario = formularioVacio(regla);
  rellenar(formulario);
  return { numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: [] };
}

function pintar(
  tarea: TareaParaHacer,
  opts: { marcadas?: Record<string, string>; fallos?: number[] | null; bloqueada?: boolean },
): string {
  return renderToStaticMarkup(
    <TareaDelEstudiante
      tarea={tarea}
      marcadas={opts.marcadas ?? {}}
      fallos={opts.fallos ?? null}
      bloqueada={opts.bloqueada ?? false}
      alMarcar={() => {}}
    />,
  );
}

// CE-2: LISTA_COMUN, tres textos sueltos (las tres personas), seis preguntas 7-12.
function lecturaDos(): TareaParaHacer {
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

// CE-1: RELACIONAR, seis elementos con texto, diez destinos A-J, ejemplo en la letra B.
function lecturaUnoConEjemploEnB(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 1)!;
  return tareaDe(1, regla, (f) => {
    if (f.forma !== "RELACIONAR") throw new Error("regla equivocada");
    f.consigna = "Relaciona cada mensaje con su texto.";
    f.actividad.ejemplo = { texto: "Texto del ejemplo", letra: "B" };
    f.actividad.elementos = f.actividad.elementos.map((e) => ({ ...e, texto: `Mensaje ${e.numero}` }));
    f.actividad.destinos = f.actividad.destinos.map((d) => ({ ...d, titulo: `Título ${d.letra}`, texto: `Texto ${d.letra}` }));
  });
}

// CO-1: OPCIONES, ejemplo y las cuatro primeras preguntas con la opción en foto.
function auditivaUnoConFotos(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;
  return tareaDe(1, regla, (f) => {
    if (f.forma !== "OPCIONES") throw new Error("regla equivocada");
    f.consigna = "Escucha y elige la foto que corresponde.";
    if (f.actividad.ejemplo) {
      f.actividad.ejemplo.enunciado = "Enunciado del ejemplo";
      f.actividad.ejemplo.letra = "A";
      for (const o of f.actividad.ejemplo.opciones) f.medios.imagenes[`ejemplo-${o.letra}`] = `foto-ejemplo-${o.letra}`;
    }
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Enunciado ${p.numero}` }));
    for (const p of f.actividad.preguntas) {
      for (const o of p.opciones) {
        if (o.conImagen) f.medios.imagenes[`${p.numero}-${o.letra}`] = `foto-${p.numero}-${o.letra}`;
      }
    }
  });
}

describe("TareaDelEstudiante", () => {
  // Mutación que la mata: pintar `datos` tal cual sin el estado marcado. El
  // estudiante recargaría y se encontraría el examen en blanco.
  // El orden real que emite React para un <input> es `checked` antes que
  // `value` (lo reordena siempre así, sin importar el orden de las props en
  // el JSX): se comprueba tal cual sale, no como se escribió.
  it("enseña marcada la letra que ya eligió", () => {
    const html = pintar(lecturaDos(), { marcadas: { "8": "B" } });
    expect(html).toContain('checked="" value="B"');
  });

  // Mutación que la mata: dejar los radios vivos en una prueba entregada.
  it("entregada se ve pero no se toca", () => {
    const html = pintar(lecturaDos(), { marcadas: { "8": "B" }, bloqueada: true });
    expect(html).toContain("disabled");
    expect(html).toContain("Pregunta 8");
  });

  // Mutación que la mata: enseñar la letra correcta al corregir. Es la decisión
  // del profesor: ve su fallo, no la solución.
  it("al corregir marca el fallo y NO dice cuál era la buena", () => {
    const tarea = lecturaDos();
    const html = pintar(tarea, { marcadas: { "8": "B" }, fallos: [8] });
    expect(html).not.toBe("");
    expect(html).toContain('data-fallo="8"');
    expect(html).not.toContain("La respuesta correcta");
  });

  // Mutación que la mata: ofrecer en relacionar también la letra del ejemplo, que
  // ya está gastada.
  it("relacionar no ofrece la letra del ejemplo", () => {
    const html = pintar(lecturaUnoConEjemploEnB(), {});
    expect(html).not.toBe("");
    expect(html).not.toContain('value="B"');
    expect(html).toContain('value="A"');
  });

  // Mutación que la mata: no pintar las fotos de las opciones con imagen. La
  // auditiva 1 son cuatro preguntas donde la respuesta ES la foto.
  it("las opciones con foto salen por la ruta de ficheros", () => {
    const html = pintar(auditivaUnoConFotos(), {});
    expect(html).toContain('src="/api/ficheros/foto-1-A"');
  });

  // Mutación que la mata: dejar de pintar los textos sueltos (las tres personas de
  // la lectura 2, el texto largo de la 3). Sin ellos no se puede contestar.
  it("los textos sueltos se pintan enteros", () => {
    const html = pintar(lecturaDos(), {});
    expect(html).toContain("Texto 1");
    expect(html).toContain("Texto 3");
  });
});
