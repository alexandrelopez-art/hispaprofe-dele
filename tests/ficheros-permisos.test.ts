import { describe, it, expect } from "vitest";
import { puedeVerFichero } from "@/lib/ficheros/permisos";

const PROFESOR = { id: "p1", papel: "PROFESOR" } as const;
const ANA = { id: "e1", papel: "ESTUDIANTE" } as const;
const NINGUNO: ReadonlySet<string> = new Set();

describe("quién puede abrir un fichero", () => {
  // Mutación que la mata: devolver true por defecto, que es como estaba la ruta
  // antes (cualquiera con sesión abría cualquier fichero por su id).
  it("el profesor sí, y un estudiante solo lo suyo", () => {
    expect(puedeVerFichero(PROFESOR, { id: "f1", subidoPorId: null }, NINGUNO)).toBe(true);
    expect(puedeVerFichero(PROFESOR, { id: "f1", subidoPorId: "e1" }, NINGUNO)).toBe(true);
    expect(puedeVerFichero(ANA, { id: "f1", subidoPorId: "e1" }, NINGUNO)).toBe(true);
  });

  // Mutación que la mata: comparar con !== , o dar por bueno el fichero sin dueño
  // (las páginas del examen tienen subidoPorId del profesor, pero las viejas
  // pueden tenerlo en nulo: un nulo NO es «de todos»).
  it("lo de otro y lo que no tiene dueño, no", () => {
    expect(puedeVerFichero(ANA, { id: "f1", subidoPorId: "e2" }, NINGUNO)).toBe(false);
    expect(puedeVerFichero(ANA, { id: "f1", subidoPorId: null }, NINGUNO)).toBe(false);
  });

  // Mutación que la mata: ignorar el conjunto y contestar por el dueño nada más.
  // El material del examen no es de quien lo hace: es del profesor que lo subió,
  // y el estudiante lo ve solo mientras tiene esa prueba abierta.
  //
  // Qué ficheros entran en el conjunto —la pista de la tarea Y las fotos de sus
  // opciones, y jamás una hoja escaneada— lo decide y lo prueba
  // `ficherosDeLasPruebasAbiertas` (tests/base/ficheros-del-estudiante.test.ts),
  // que es quien sabe de tareas. Aquí solo se comprueba que se mira.
  it("el material del examen, solo si está entre los abiertos", () => {
    const abiertos = new Set(["pista-de-co1", "foto-1-a"]);
    expect(puedeVerFichero(ANA, { id: "pista-de-co1", subidoPorId: "profesor" }, abiertos)).toBe(true);
    expect(puedeVerFichero(ANA, { id: "foto-1-a", subidoPorId: "profesor" }, abiertos)).toBe(true);
    expect(puedeVerFichero(ANA, { id: "hoja-escaneada", subidoPorId: "profesor" }, abiertos)).toBe(false);
    expect(puedeVerFichero(ANA, { id: "pista-de-co1", subidoPorId: "profesor" }, NINGUNO)).toBe(false);
  });
});
