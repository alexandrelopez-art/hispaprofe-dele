import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// El formulario importa la acción, y la acción la base: aquí no hay base.
vi.mock("@/app/(sitio)/examenes/acciones", () => ({ guardarTareaAccion: vi.fn(), rellenarTareaConIAAccion: vi.fn() }));

import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
import { FormularioDeTarea } from "@/components/taller/formulario-de-tarea";

const VACIA = { estado: "VACIA" as const, motivos: ["Sin guardar todavía."] };

function pintar(
  prueba: "CE" | "CO" | "EO",
  numero: number,
  respuestas: Record<string, string> | null,
  temas: string[] | null = null,
  hayClave = true,
  hayHojas = true,
  extra: { inicial?: Formulario; bloqueo?: string | null } = {},
) {
  const regla = reglaDe("A2_B1_ESCOLAR", prueba, numero)!;
  return renderToStaticMarkup(
    <FormularioDeTarea
      examenId="x1"
      prueba={prueba}
      numero={numero}
      regla={regla}
      inicial={extra.inicial ?? formularioVacio(regla)}
      respuestas={respuestas}
      temasDeLaHermana={temas}
      estadoInicial={VACIA}
      hayClave={hayClave}
      hayHojas={hayHojas}
      bloqueo={extra.bloqueo ?? null}
    />,
  );
}

describe("el formulario de una tarea", () => {
  // La respuesta del cuadernillo se enseña, pero no se edita: va en un <span>.
  // Mutación que la mata: pintar la respuesta en un <input>.
  it("Lectura 3 enseña la respuesta de cada pregunta, sin campo para editarla", () => {
    const html = pintar("CE", 3, { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" });
    for (const n of [13, 14, 15, 16, 17, 18]) expect(html).toContain(`<span data-respuesta="${n}"`);
    expect(html).toContain("Respuesta del cuadernillo: B");
    expect(html).not.toMatch(/<input[^>]*value="B"/);
  });

  // Mutación que la mata: cambiar el texto "Sin respuesta en el cuadernillo" en components/taller/campo.tsx.
  it("sin cuadernillo lo dice en cada pregunta", () => {
    expect(pintar("CE", 3, null)).toContain("Sin respuesta en el cuadernillo");
  });

  // Mutación que la mata: quitar el prefijo "Va con: " en FormaOralDirecto (formas-abiertas.tsx).
  it("una oral en directo enseña el tema de su hermana al lado de cada opción", () => {
    const html = pintar("EO", 2, null, ["Las vacaciones", "El deporte"]);
    expect(html).toContain("Va con: Las vacaciones");
    expect(html).toContain("Va con: El deporte");
  });

  // Mutación que la mata: cambiar "Texto {d.letra}" por otro texto en FormaRelacionar (formas-cerradas.tsx).
  it("Lectura 1 tiene los diez textos de la A a la J", () => {
    const html = pintar("CE", 1, null);
    for (const letra of "ABCDEFGHIJ") expect(html).toContain(`Texto ${letra}`);
  });
});

describe("el botón de rellenar con IA", () => {
  // Mutación que la mata: no apagar el botón sin hojas. Se mira el atributo
  // `disabled=""`, no la palabra suelta (la clase `disabled:` del kit daría
  // un falso verde).
  it("sin hojas etiquetadas sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, true, false);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Etiqueta primero las hojas de esta tarea.");
  });

  // Mutación que la mata: no apagar el botón sin clave.
  it("sin clave sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, false, true);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Falta la clave de la IA.");
  });

  // Mutación que la mata: dejarlo apagado siempre.
  it("con hojas y clave sale encendido y sin avisos", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html).toMatch(/<button[^>]*>Rellenar con IA<\/button>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Rellenar con IA/);
    expect(html).not.toContain("Falta la clave de la IA.");
  });

  // Mutación que la mata: volver a poner el bloque del botón debajo del formulario.
  it("el botón va encima del formulario, antes de la consigna", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html.indexOf(">Rellenar con IA<")).toBeGreaterThan(-1);
    expect(html.indexOf("Consigna, ya corregida")).toBeGreaterThan(-1);
    expect(html.indexOf(">Rellenar con IA<")).toBeLessThan(html.indexOf("Consigna, ya corregida"));
  });

  // Mutación que la mata: volver a la clase a mano (border-hp-400) en vez del
  // Boton secundario del kit. No hay jsdom para fijar `rellenando` desde
  // fuera, así que se comprueba la clase que trae ese estado.
  it("el botón de Rellenar con IA lleva la clase del Boton secundario del kit", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html).toMatch(/<button[^>]*border-hp-300[^>]*>Rellenar con IA<\/button>/);
  });

  // Mutación que la mata: dejar el Guardar de hoy con bg-hp-400 en vez del
  // Boton principal del kit (bg-hp-700).
  it("no queda ninguna clase bg-hp-400 en el formulario", () => {
    const html = pintar("CE", 3, null);
    expect(html).not.toContain("bg-hp-400");
  });
});

describe("fotos y solo lectura", () => {
  // Mutación que la mata: dejar el texto «se sube en la Entrega 3» en Opciones.
  it("Auditiva 1 enseña un hueco de foto por cada opción con imagen, y ningún aviso viejo", () => {
    const html = pintar("CO", 1, null);
    expect(html.match(/data-foto="/g)).toHaveLength(15);
    expect(html).toContain('data-foto="ejemplo-A"');
    expect(html).toContain('data-foto="4-C"');
    expect(html).toContain("Subir foto");
    expect(html).not.toContain("Entrega 3");
  });

  // Mutación que la mata: en FotoDeOpcion, no pintar la miniatura cuando hay ficheroId.
  it("una foto ya subida se ve desde el almacén", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    f.medios.imagenes["ejemplo-A"] = "f1";
    const html = pintar("CO", 1, null, null, true, true, { inicial: f });
    expect(html).toContain('src="/api/ficheros/f1"');
    expect(html.match(/Subir foto/g)).toHaveLength(14);
  });

  // Mutación que la mata: en FormaOralSolo, dejar «Foto: se sube en la Entrega 3».
  it("Oral 1 tiene una foto por opción; Oral 3, ninguna", () => {
    expect(pintar("EO", 1, null)).toContain('data-foto="opcion-2"');
    expect(pintar("EO", 3, null)).not.toContain("data-foto=");
  });

  // Mutación que la mata: no pasar `bloqueo` al fieldset.
  it("con el examen publicado, aviso arriba y todo apagado", () => {
    const html = pintar("CE", 3, null, null, true, true, { bloqueo: MENSAJE_PUBLICADO });
    expect(html).toContain("El examen está publicado: retíralo para editarlo.");
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Rellenar con IA<\/button>/);
  });
});

describe("el bloque de audio", () => {
  const conPista = (numero: number, cortes: number[]) => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", numero)!);
    f.medios.audio = { fichero: "a1", cortes };
    return f;
  };

  // Mutación que la mata: pintar el bloque también en tareas sin `trozos`.
  it("solo en auditiva, y sin pista pide subirla", () => {
    const html = pintar("CO", 4, null);
    expect(html).toContain("data-bloque-audio");
    expect(html).toContain("Subir la pista");
    expect(pintar("CE", 3, null)).not.toContain("data-bloque-audio");
  });

  // Mutación que la mata: comparar cortes.length con trozos en el contador.
  it("el contador dice cuántos trozos salen y cuántos lleva la tarea", () => {
    const mal = pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100]) });
    expect(mal).toContain('data-contador="mal"');
    expect(mal).toContain("1 marca → 2 trozos, esta tarea lleva 3");
    const bien = pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100, 200]) });
    expect(bien).toContain('data-contador="bien"');
    expect(bien).toContain("2 marcas → 3 trozos, esta tarea lleva 3");
  });

  // Mutación que la mata: pintar el contador también cuando trozos === 1.
  it("Auditiva 3 no se corta: sin contador ni botón de proponer", () => {
    const html = pintar("CO", 3, null, null, true, true, { inicial: conPista(3, []) });
    expect(html).toContain("Esta tarea no se corta");
    expect(html).not.toContain("data-contador");
    expect(html).not.toContain("Proponer marcas");
  });

  // Mutación que la mata: no concordar "trozo"/"trozos" con marcas + 1.
  it("el contador concuerda el singular cuando queda un solo trozo por delante", () => {
    const html = pintar("CO", 4, null, null, true, true, { inicial: conPista(4, []) });
    expect(html).toContain('data-contador="mal"');
    expect(html).toContain("0 marcas → 1 trozo, esta tarea lleva 3");
  });

  // Mutación que la mata: dejar el <audio> sin la ruta del fichero.
  it("con pista, el reproductor apunta a la pista guardada", () => {
    expect(pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100, 200]) })).toContain('src="/api/ficheros/a1"');
  });
});
