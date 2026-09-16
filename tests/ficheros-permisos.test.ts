import { describe, it, expect } from "vitest";
import { puedeVerFichero } from "@/lib/ficheros/permisos";

const PROFESOR = { id: "p1", papel: "PROFESOR" } as const;
const ANA = { id: "e1", papel: "ESTUDIANTE" } as const;

describe("quién puede abrir un fichero", () => {
  // Mutación que la mata: devolver true por defecto, que es como estaba la ruta
  // antes (cualquiera con sesión abría cualquier fichero por su id).
  it("el profesor sí, y un estudiante solo lo suyo", () => {
    expect(puedeVerFichero(PROFESOR, { subidoPorId: null, piezas: [] }, [])).toBe(true);
    expect(puedeVerFichero(PROFESOR, { subidoPorId: "e1", piezas: [] }, [])).toBe(true);
    expect(puedeVerFichero(ANA, { subidoPorId: "e1", piezas: [] }, [])).toBe(true);
  });

  // Mutación que la mata: comparar con !== , o dar por bueno el fichero sin dueño
  // (las páginas del examen tienen subidoPorId del profesor, pero las viejas
  // pueden tenerlo en nulo: un nulo NO es «de todos»).
  it("lo de otro y lo que no tiene dueño, no", () => {
    expect(puedeVerFichero(ANA, { subidoPorId: "e2", piezas: [] }, [])).toBe(false);
    expect(puedeVerFichero(ANA, { subidoPorId: null, piezas: [] }, [])).toBe(false);
  });

  const PISTA = { subidoPorId: "profesor", piezas: [{ tarea: { examenId: "ex1", prueba: "CO" as const } }] };
  const PAGINA = { subidoPorId: "profesor", piezas: [] };

  // Mutación que la mata: dar por buena cualquier pieza sin mirar si la prueba está
  // abierta. El estudiante se bajaría la pista antes de empezar y la oiría entera.
  it("el estudiante ve la pista solo con su prueba abierta", () => {
    expect(puedeVerFichero(ANA, PISTA, [])).toBe(false);
    expect(puedeVerFichero(ANA, PISTA, [{ examenId: "ex1", prueba: "CE" }])).toBe(false);
    expect(puedeVerFichero(ANA, PISTA, [{ examenId: "otro", prueba: "CO" }])).toBe(false);
    expect(puedeVerFichero(ANA, PISTA, [{ examenId: "ex1", prueba: "CO" }])).toBe(true);
  });

  // Mutación que la mata: meter las páginas en la lista blanca. Una hoja escaneada
  // no cuelga de ninguna pieza, y es el examen entero en PDF.
  it("una página escaneada no la ve ningún estudiante, nunca", () => {
    expect(puedeVerFichero(ANA, PAGINA, [{ examenId: "ex1", prueba: "CO" }])).toBe(false);
    expect(puedeVerFichero({ id: "p", papel: "PROFESOR" }, PAGINA, [])).toBe(true);
  });
});
