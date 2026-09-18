import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Boton, clasesDeBoton } from "@/components/ui/boton";
import { Enlace } from "@/components/ui/enlace";
import { Aviso } from "@/components/ui/aviso";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Campo } from "@/components/ui/campo";
import { Desplegable } from "@/components/ui/desplegable";
import { BloqueVacio } from "@/components/ui/bloque-vacio";
import { GrupoDeOpciones } from "@/components/ui/grupo-de-opciones";

/** La etiqueta de apertura del primer <button>, para mirar sus atributos sin
 *  que la clase `disabled:…` de Tailwind cuente como el atributo. */
function aperturaDelBoton(html: string): string {
  return html.match(/<button[^>]*>/)?.[0] ?? "";
}

describe("Boton", () => {
  // Mutación que la mata: volver al hp-400 en el principal. Letra blanca sobre
  // azul claro es lo que no se leía.
  it("el principal es azul oscuro, nunca el claro", () => {
    expect(clasesDeBoton("principal")).toContain("bg-hp-700");
    expect(clasesDeBoton("principal")).not.toContain("bg-hp-400");
  });

  // Mutación que la mata: no apagar el botón mientras envía (doble envío).
  it("enviando se apaga y dice lo que hace", () => {
    const html = renderToStaticMarkup(<Boton enviando textoEnviando="Guardando…">Guardar</Boton>);
    expect(aperturaDelBoton(html)).toMatch(/\sdisabled=""/);
    expect(html).toContain("Guardando…");
    expect(html).not.toContain(">Guardar<");
  });

  // Mutación que la mata: apagarlo siempre (p. ej. `disabled={true}`).
  it("en reposo no está apagado y es type=button por defecto", () => {
    const apertura = aperturaDelBoton(renderToStaticMarkup(<Boton>Guardar</Boton>));
    expect(apertura).not.toMatch(/\sdisabled=""/);
    expect(apertura).toContain('type="button"');
  });

  // Mutación que la mata: quitar las clases de foco de la base.
  it("todas las variantes enseñan el foco del teclado", () => {
    for (const v of ["principal", "secundario", "peligro"] as const) {
      expect(clasesDeBoton(v)).toContain("focus-visible:outline");
    }
  });
});

describe("Enlace", () => {
  // Mutación que la mata: ignorar `comoBoton` y pintar siempre el enlace subrayado.
  it("con comoBoton lleva las clases del botón", () => {
    const html = renderToStaticMarkup(<Enlace href="/x" comoBoton="principal">Empezar</Enlace>);
    expect(html).toContain('href="/x"');
    expect(html).toContain("bg-hp-700");
  });
});

describe("Aviso", () => {
  // Mutación que la mata: dar role=alert a todos (un lector de pantalla
  // interrumpiría por cada aviso informativo) o a ninguno.
  it("solo el de error interrumpe", () => {
    expect(renderToStaticMarkup(<Aviso tono="error">Fallo</Aviso>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Aviso tono="aviso">Tarde</Aviso>)).not.toContain('role="alert"');
  });

  // Mutación que la mata: pintar el tono «aviso» con los colores de error.
  // Llegar tarde no es un fallo del sistema.
  it("el aviso es coral y el error es error", () => {
    expect(renderToStaticMarkup(<Aviso tono="aviso">x</Aviso>)).toContain("coral");
    expect(renderToStaticMarkup(<Aviso tono="aviso">x</Aviso>)).not.toContain("error-");
    expect(renderToStaticMarkup(<Aviso tono="error">x</Aviso>)).toContain("error-");
  });
});

describe("EtiquetaEstado", () => {
  // Mutación que la mata: un tono fijo para todos.
  it("cada tono tiene su color", () => {
    expect(renderToStaticMarkup(<EtiquetaEstado tono="exito">Hecha</EtiquetaEstado>)).toContain("verde");
    expect(renderToStaticMarkup(<EtiquetaEstado tono="aviso">Tarde</EtiquetaEstado>)).toContain("coral");
  });
});

describe("Campo y Desplegable", () => {
  // Mutación que la mata: no atar la etiqueta al control con htmlFor/id.
  it("la etiqueta apunta a su control", () => {
    const campo = renderToStaticMarkup(<Campo id="nombre" etiqueta="Nombre" />);
    expect(campo).toContain('for="nombre"');
    expect(campo).toContain('id="nombre"');
    const lista = renderToStaticMarkup(
      <Desplegable id="modo" etiqueta="Modo" opciones={[{ valor: "COMPLETO", texto: "Completo" }]} />,
    );
    expect(lista).toContain('for="modo"');
    expect(lista).toContain('<option value="COMPLETO">Completo</option>');
  });

  // Mutación que la mata: pintar el error sin atarlo al control (aria-describedby).
  it("el error se ata al control", () => {
    const html = renderToStaticMarkup(<Campo id="c" etiqueta="Correo" error="Falta la arroba." />);
    expect(html).toContain('aria-describedby="c-error"');
    expect(html).toContain('id="c-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  // Mutación que la mata: ignorar `multilinea` y pintar siempre un input.
  it("multilinea es un textarea", () => {
    expect(renderToStaticMarkup(<Campo id="t" etiqueta="Texto" multilinea />)).toContain("<textarea");
  });
});

describe("BloqueVacio", () => {
  // Mutación que la mata: no pintar el título.
  it("dice qué pasa y, si la hay, ofrece la acción", () => {
    const html = renderToStaticMarkup(
      <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando…" accion={<a href="/x">Ir</a>} />,
    );
    expect(html).toContain("No tienes nada pendiente");
    expect(html).toContain('href="/x"');
  });
});

const BANDAS = ["0", "1", "2", "3"].map((v) => ({ valor: v, texto: v }));
const radios = (html: string) => html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];

describe("GrupoDeOpciones", () => {
  // Mutación que la mata: tratar null como "0" (p. ej. `checked={String(valor ?? 0) === o.valor}`).
  // Una nota sin poner no es un 0: es justo el agujero que las notas vacías tapan.
  it("con valor null no marca ninguno", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="b" leyenda="Coherencia" opciones={BANDAS} forma="segmentos" valor={null} alCambiar={() => {}} />,
    );
    expect(radios(html)).toHaveLength(4);
    expect(radios(html).some((r) => /\schecked=""/.test(r))).toBe(false);
  });

  // Mutación que la mata: comparar con `==` contra un número, o marcar por índice.
  it("con valor \"0\" marca el 0 y solo el 0", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="b" leyenda="Coherencia" opciones={BANDAS} forma="segmentos" valor="0" alCambiar={() => {}} />,
    );
    const marcados = radios(html).filter((r) => /\schecked=""/.test(r));
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toContain('value="0"');
  });

  // Mutación que la mata: quitar el <legend> o esconderlo con sr-only. Sin él, un
  // lector de pantalla oye «2, 3» sin saber de qué criterio.
  it("lleva fieldset y una leyenda visible", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="m" leyenda="Cómo lo hace" opciones={BANDAS} />);
    expect(html).toMatch(/<fieldset[^>]*>[\s\S]*<legend[^>]*>Cómo lo hace<\/legend>/);
    expect(html).not.toMatch(/<legend[^>]*sr-only/);
  });

  // Mutación que la mata: poner el mismo id a todos, o quitar el name.
  it("cada radio tiene su id y todos el mismo name", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="modo" leyenda="Modo" opciones={BANDAS} />);
    const ids = radios(html).map((r) => r.match(/id="([^"]+)"/)![1]);
    expect(new Set(ids).size).toBe(4);
    expect(radios(html).every((r) => r.includes('name="modo"'))).toBe(true);
  });

  // Mutación que la mata: ignorar valorInicial (el formulario de asignar
  // nacería sin modo y el servidor recibiría null).
  it("sin control, marca valorInicial", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="modo" leyenda="Modo" opciones={BANDAS} valorInicial="2" />,
    );
    expect(radios(html).filter((r) => /\schecked=""/.test(r))[0]).toContain('value="2"');
  });

  // Mutación que la mata: no pasar `disabled` al fieldset.
  it("disabled apaga el grupo entero", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="m" leyenda="M" opciones={BANDAS} disabled />);
    expect(html).toMatch(/<fieldset[^>]*\sdisabled=""/);
  });
});
