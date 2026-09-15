// tests/taller-piezas.test.ts
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS, PRUEBAS, reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { formularioDePiezas, piezasDelFormulario, type PiezaLeida } from "@/lib/taller/piezas";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;
const TODAS = PRUEBAS.flatMap((p) => ESCOLAR[p].map((r) => ({ nombre: `${p}-${r.numero}`, regla: r })));

/** Lo que devolvería Prisma al leer las piezas guardadas. */
function comoLeidas(f: Parameters<typeof piezasDelFormulario>[0]): PiezaLeida[] {
  return piezasDelFormulario(f).map((p) => ({
    orden: p.orden,
    tipo: p.tipo,
    texto: p.texto,
    etiqueta: p.etiqueta,
    ficheroId: p.ficheroId,
    cortes: p.cortes,
    actividad: p.actividad ? { datos: JSON.parse(JSON.stringify(p.actividad.datos)) } : null,
  }));
}

describe("formulario y piezas", () => {
  // Mutación que la mata: olvidar los textos sueltos al leer.
  it.each(TODAS)("$nombre va y vuelve igual", ({ regla }) => {
    const f = formularioVacio(regla);
    f.consigna = "Lee y responde.";
    f.textos = f.textos.map((t, i) => ({ etiqueta: `Persona ${i + 1}`, texto: `Texto ${i + 1}` }));
    expect(formularioDePiezas(comoLeidas(f))).toEqual(f);
  });

  // Mutación que la mata: poner el orden de la actividad en `f.textos.length`
  // en vez de `f.textos.length + 1` (choca con el último texto suelto).
  it("Lectura 2 son cinco piezas en orden seguido: consigna, tres textos y la actividad", () => {
    const piezas = piezasDelFormulario(formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 2)!));
    expect(piezas.map((p) => [p.orden, p.tipo])).toEqual([
      [0, "TEXTO"], [1, "TEXTO"], [2, "TEXTO"], [3, "TEXTO"], [4, "ACTIVIDAD"],
    ]);
    expect(piezas[0].etiqueta).toBe("consigna");
  });

  // Mutación que la mata: usar `f.forma` en vez de `TIPO_DE_ACTIVIDAD[f.forma]`
  // como tipo de la actividad guardada.
  it("la actividad lleva el tipo que toca", () => {
    const tipo = (prueba: "CE" | "EO", n: number) =>
      piezasDelFormulario(formularioVacio(reglaDe("A2_B1_ESCOLAR", prueba, n)!)).at(-1)!.actividad!.tipo;
    expect(tipo("CE", 4)).toBe("HUECOS");
    expect(tipo("EO", 2)).toBe("CONVERSACION");
  });

  // Aunque se lea en otro orden, la consigna es la pieza 0.
  // Mutación que la mata: quitar el `.sort((a, b) => a.orden - b.orden)` antes
  // de buscar la consigna y los textos en `formularioDePiezas`.
  it("el orden de lectura no importa", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    f.consigna = "Consigna";
    f.textos[0].texto = "El texto";
    expect(formularioDePiezas(comoLeidas(f).reverse())).toEqual(f);
  });

  // Mutación que la mata: quitar el `if (!datos || typeof datos !== "object")
  // return null;` de `formularioDePiezas` (revienta al desestructurar `datos`
  // en vez de devolver null en el caso de piezas vacías).
  it("sin actividad, o con datos que ya no casan, no hay formulario", () => {
    expect(formularioDePiezas([])).toBeNull();
    const piezas = comoLeidas(formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!));
    piezas.at(-1)!.actividad = { datos: { forma: "OPCIONES", correcta: "B" } };
    expect(formularioDePiezas(piezas)).toBeNull();
  });

  // Mutación que la mata: no leer `imagenes` de los datos, o no leer la pieza AUDIO.
  it("Auditiva 1 con fotos y pista va y vuelve igual", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    f.medios = { imagenes: { "ejemplo-A": "f1", "4-C": "f2" }, audio: { fichero: "a1", cortes: [12.5, 60] } };
    expect(formularioDePiezas(comoLeidas(f))).toEqual(f);
  });

  // Mutación que la mata: dejar la actividad en `f.textos.length + 1` también cuando hay audio (choca con la pieza AUDIO).
  it("con pista: consigna, audio y actividad, en orden seguido", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 3)!);
    f.medios.audio = { fichero: "a1", cortes: [] };
    expect(piezasDelFormulario(f).map((p) => [p.orden, p.tipo, p.ficheroId])).toEqual([
      [0, "TEXTO", null], [1, "AUDIO", "a1"], [2, "ACTIVIDAD", null],
    ]);
  });

  // Mutación que la mata: exigir `imagenes` en los datos (lo guardado antes de la Entrega 3a no lo trae).
  it("lo guardado antes de esta entrega, sin imagenes ni pista, se lee con medios vacíos", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    const leidas = comoLeidas(f).map((p) => {
      if (!p.actividad) return p;
      const { imagenes: _fuera, ...datos } = p.actividad.datos as Record<string, unknown>;
      return { ...p, actividad: { datos } };
    });
    expect(formularioDePiezas(leidas)?.medios).toEqual({ imagenes: {}, audio: null });
  });
});
