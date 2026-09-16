import { describe, it, expect } from "vitest";
import { puedeVerFichero } from "@/lib/ficheros/permisos";

const PROFESOR = { id: "p1", papel: "PROFESOR" } as const;
const ANA = { id: "e1", papel: "ESTUDIANTE" } as const;

describe("quién puede abrir un fichero", () => {
  // Mutación que la mata: devolver true por defecto, que es como estaba la ruta
  // antes (cualquiera con sesión abría cualquier fichero por su id).
  it("el profesor sí, y un estudiante solo lo suyo", () => {
    expect(puedeVerFichero(PROFESOR, { subidoPorId: null })).toBe(true);
    expect(puedeVerFichero(PROFESOR, { subidoPorId: "e1" })).toBe(true);
    expect(puedeVerFichero(ANA, { subidoPorId: "e1" })).toBe(true);
  });

  // Mutación que la mata: comparar con !== , o dar por bueno el fichero sin dueño
  // (las páginas del examen tienen subidoPorId del profesor, pero las viejas
  // pueden tenerlo en nulo: un nulo NO es «de todos»).
  it("lo de otro y lo que no tiene dueño, no", () => {
    expect(puedeVerFichero(ANA, { subidoPorId: "e2" })).toBe(false);
    expect(puedeVerFichero(ANA, { subidoPorId: null })).toBe(false);
  });
});
