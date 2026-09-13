import { describe, it, expect } from "vitest";
import {
  ESTRUCTURAS,
  PRUEBAS,
  esPrueba,
  etiquetasDeNivel,
  letrasHasta,
  nivelesConReglas,
  nombreDeEtiqueta,
  reglaDe,
} from "@/lib/dele/estructura";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

describe("la estructura del A2/B1 escolar", () => {
  it("la comprensión de lectura son 4 tareas de 6, 6, 6 y 7 ítems", () => {
    expect(ESCOLAR.CE.map((r) => r.items)).toEqual([6, 6, 6, 7]);
  });

  it("la comprensión auditiva son 4 tareas de 7, 6, 6 y 6 ítems", () => {
    expect(ESCOLAR.CO.map((r) => r.items)).toEqual([7, 6, 6, 6]);
  });

  // La numeración del libro va seguida dentro de cada prueba: es lo que
  // permite casar cada ítem con su respuesta del cuadernillo.
  // Mutación que la mata: cambiar el primero de CE3 a 12.
  it("el primer número de cada tarea sigue a la anterior", () => {
    for (const prueba of ["CE", "CO"] as const) {
      let siguiente = 1;
      for (const regla of ESCOLAR[prueba]) {
        expect(regla.primero).toBe(siguiente);
        siguiente += regla.items!;
      }
      expect(siguiente).toBe(26);
    }
  });

  it("escrita y oral son de respuesta abierta, sin números ni letras", () => {
    for (const regla of [...ESCOLAR.EE, ...ESCOLAR.EO]) {
      expect(regla.items).toBeNull();
      expect(regla.primero).toBeNull();
      expect(regla.letras).toBe(0);
    }
    expect(ESCOLAR.EE).toHaveLength(2);
    expect(ESCOLAR.EO).toHaveLength(4);
  });

  // Comprobado contra las páginas: diez destinos A-J y un ejemplo resuelto.
  it("Lectura 1 y Auditiva 2 relacionan con diez letras y traen ejemplo", () => {
    for (const regla of [reglaDe("A2_B1_ESCOLAR", "CE", 1)!, reglaDe("A2_B1_ESCOLAR", "CO", 2)!]) {
      expect(regla.forma).toBe("RELACIONAR");
      expect(regla.letras).toBe(10);
      expect(regla.ejemplo).toBe(true);
    }
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 1)!.elementosConTexto).toBe(true);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 2)!.elementosConTexto).toBe(false);
  });

  it("llevan ejemplo exactamente CE1, CO1, CO2 y CO3", () => {
    const conEjemplo = PRUEBAS.flatMap((p) => ESCOLAR[p].filter((r) => r.ejemplo).map((r) => `${p}-${r.numero}`));
    expect(conEjemplo).toEqual(["CE-1", "CO-1", "CO-2", "CO-3"]);
  });

  it("las orales en directo van con su oral en solitario", () => {
    const eo = (n: number) => reglaDe("A2_B1_ESCOLAR", "EO", n)!;
    expect(eo(2)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 1 });
    expect(eo(4)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 3 });
    expect(eo(1)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: true });
    expect(eo(3)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: false });
  });

  it("Auditiva 1 tiene imágenes en las cuatro primeras y Auditiva 4 tres noticias", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 1)!.itemsConImagen).toBe(4);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 4)!.grupos).toBe(3);
  });
});

describe("los niveles", () => {
  // Mutación que la mata: poner las reglas del escolar también en B1.
  it("solo el escolar tiene reglas hoy", () => {
    expect(nivelesConReglas()).toEqual(["A2_B1_ESCOLAR"]);
    expect(reglaDe("B1", "CE", 1)).toBeNull();
  });

  it("reglaDe devuelve null para una tarea que no existe", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 5)).toBeNull();
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 0)).toBeNull();
  });
});

describe("nombres y etiquetas", () => {
  it("letrasHasta da las letras en orden", () => {
    expect(letrasHasta(3)).toEqual(["A", "B", "C"]);
    expect(letrasHasta(10).at(-1)).toBe("J");
  });

  it("las etiquetas del escolar son las catorce, en orden de prueba", () => {
    expect(etiquetasDeNivel("A2_B1_ESCOLAR")).toEqual([
      "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4",
      "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
    ]);
    expect(etiquetasDeNivel("B2")).toEqual([]);
  });

  it("una etiqueta se lee sin jerga", () => {
    expect(nombreDeEtiqueta("CE-3")).toBe("Lectura 3");
    expect(nombreDeEtiqueta("EO-2")).toBe("Oral 2");
  });

  it("esPrueba solo acepta las cuatro", () => {
    expect(esPrueba("CO")).toBe(true);
    expect(esPrueba("XX")).toBe(false);
  });
});
