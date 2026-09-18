import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { CabeceraExamen, VentanaDeSalida, frasesDeSalida } from "@/components/carcasa/cabecera-examen";

const APUNTADO = "Salir queda apuntado";

describe("lo que dice la ventana de salir", () => {
  // Mutación que la mata: decir lo del reloj en práctica libre (no hay reloj),
  // o callárselo con reloj.
  it("el reloj solo se nombra cuando corre", () => {
    expect(frasesDeSalida({ conReloj: true, escrita: false }).join(" ")).toContain("El reloj sigue corriendo aunque salgas.");
    expect(frasesDeSalida({ conReloj: false, escrita: false }).join(" ")).not.toContain("reloj");
  });

  // Mutación que la mata: quitar la frase de «queda apuntado» en la escrita,
  // o decirla en la lectura (allí no se apunta nada) o en libre.
  it("solo la escrita con reloj avisa de que queda apuntado", () => {
    expect(frasesDeSalida({ conReloj: true, escrita: true }).join(" ")).toContain(APUNTADO);
    expect(frasesDeSalida({ conReloj: true, escrita: false }).join(" ")).not.toContain(APUNTADO);
    expect(frasesDeSalida({ conReloj: false, escrita: true }).join(" ")).not.toContain(APUNTADO);
  });

  // Mutación que la mata: quitar la frase que tranquiliza.
  it("siempre dice que se puede volver", () => {
    for (const conReloj of [true, false]) {
      for (const escrita of [true, false]) {
        expect(frasesDeSalida({ conReloj, escrita, libre: false }).join(" ")).toContain("Podrás volver a entrar");
      }
    }
  });

  // Mutación que la mata: volver a decir «mientras la prueba no esté
  // entregada» en la práctica libre, que nunca se entrega, o callar que lo
  // marcado se pierde (Corregir en libre no escribe nada en la base).
  it("en la práctica libre dice que no se guarda, y nada de entregar", () => {
    const frases = frasesDeSalida({ conReloj: false, escrita: false, libre: true }).join(" ");
    expect(frases).toContain("Lo que marches en esta práctica no se guarda: al volver empiezas de nuevo.");
    expect(frases).not.toContain("entregada");
  });

  // Mutación que la mata: tratar libre como «sin reloj» y perder el aviso del
  // registro en la escrita de verdad.
  it("la escrita con reloj sigue diciendo que queda apuntado", () => {
    expect(frasesDeSalida({ conReloj: true, escrita: true }).join(" ")).toContain("queda apuntado");
  });

  // Mutación que la mata: no pasar `libre` de CabeceraExamen a frasesDeSalida.
  it("la cabecera lleva la frase de la práctica libre a su ventana", () => {
    const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 1, total: 4 }} reloj={null} preguntar libre />);
    expect(html).toContain("no se guarda");
  });
});

describe("la ventana", () => {
  // Mutación que la mata: usar window.confirm (no se puede vestir ni probar)
  // o no pintar los dos botones.
  it("es un diálogo de la página con sus dos salidas", () => {
    const html = renderToStaticMarkup(
      <VentanaDeSalida abierta frases={["Uno.", "Dos."]} alSeguir={() => {}} alSalir={() => {}} />,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain("¿Seguro que quieres salir?");
    expect(html).toContain("Seguir la prueba");
    expect(html).toContain("Salir de todos modos");
    expect(html).toContain("Uno.");
  });
});

/** La etiqueta de apertura del <button> cuyo texto es `texto`. Se mira el
 *  atributo en la etiqueta, no `toContain("disabled")`, que pasaría por
 *  casualidad con la clase `disabled:…` de todos los botones. */
function botonQueDice(html: string, texto: string): string {
  const m = html.match(new RegExp(`(<button[^>]*>)${texto}</button>`));
  expect(m, `no hay botón «${texto}»`).not.toBeNull();
  return m![1]!;
}

describe("la ventana mientras sale", () => {
  // Mutación que la mata: no pasar `enviando={saliendo}` al botón de salir
  // (sigue encendido y mudo mientras navega: invita al segundo clic), o no
  // apagar «Seguir la prueba» mientras sale.
  it("con saliendo, salir dice «Saliendo…» y los dos botones se apagan", () => {
    const html = renderToStaticMarkup(
      <VentanaDeSalida abierta saliendo frases={["Uno."]} alSeguir={() => {}} alSalir={() => {}} />,
    );
    expect(botonQueDice(html, "Saliendo…")).toMatch(/\sdisabled=""/);
    expect(html).not.toContain("Salir de todos modos");
    expect(botonQueDice(html, "Seguir la prueba")).toMatch(/\sdisabled=""/);
  });

  // Mutación que la mata: apagar los botones siempre (la ventana no serviría).
  it("sin salir todavía, los dos botones están encendidos", () => {
    const html = renderToStaticMarkup(
      <VentanaDeSalida abierta frases={["Uno."]} alSeguir={() => {}} alSalir={() => {}} />,
    );
    expect(botonQueDice(html, "Salir de todos modos")).not.toMatch(/\sdisabled=""/);
    expect(botonQueDice(html, "Seguir la prueba")).not.toMatch(/\sdisabled=""/);
  });
});

describe("la cabecera del examen", () => {
  // Mutación que la mata: pintar un hueco de reloj vacío en libre, o no pintar
  // el que llega.
  it("lleva el reloj que le pasan, y ninguno si no le pasan", () => {
    const con = renderToStaticMarkup(
      <CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={<p data-reloj="60">Te quedan 1:00</p>} preguntar />,
    );
    expect(con).toContain("data-reloj");
    const sin = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={null} preguntar />);
    expect(sin).not.toContain("data-reloj");
    expect(sin).not.toContain("Te quedan");
  });

  // Mutación que la mata: no enseñar la tarea, o enseñar la total como actual.
  it("dice la prueba y la tarea abierta", () => {
    const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={null} preguntar />);
    expect(html).toContain("Lectura");
    expect(html).toContain("Tarea 2 de 4");
  });

  // Mutación que la mata: dejar un enlace directo a Inicio con la prueba en
  // curso (se saldría sin la pregunta).
  it("en curso, Salir es un botón que pregunta; antes de empezar, un enlace", () => {
    const enCurso = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 1, total: 4 }} reloj={null} preguntar />);
    expect(enCurso).not.toContain('href="/"');
    expect(enCurso).toMatch(/<button[^>]*>Salir<\/button>/);
    const antes = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={null} reloj={null} preguntar={false} />);
    expect(antes).toContain('href="/"');
  });

  // Mutación que la mata: no pasar `escrita` a las frases.
  it("la de la escrita con reloj lleva la frase de apuntado", () => {
    const html = renderToStaticMarkup(
      <CabeceraExamen prueba="EE" tarea={{ actual: 1, total: 2 }} reloj={<p data-reloj="60">x</p>} preguntar escrita />,
    );
    expect(html).toContain(APUNTADO);
  });

  // Mutación que la mata: meter el menú o el nombre del estudiante.
  it("no lleva menú ni nombre", () => {
    const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={null} reloj={null} preguntar={false} />);
    expect(html).not.toContain("data-menu");
    expect(html).not.toContain('action="/salir"');
  });
});
