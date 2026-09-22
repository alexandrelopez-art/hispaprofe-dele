import { describe, it, expect } from "vitest";
import {
  CRITERIOS_EE,
  ESTRUCTURAS,
  PRUEBAS,
  esPrueba,
  etiquetasDeNivel,
  letrasHasta,
  minutosDePrueba,
  nivelesConReglas,
  nombreDeEtiqueta,
  puntosDeEscrita,
  reglaDe,
} from "@/lib/dele/estructura";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

describe("la estructura del A2/B1 escolar", () => {
  // Mutación que la mata: cambiar CE[3].items de 7 a 6.
  it("la comprensión de lectura son 4 tareas de 6, 6, 6 y 7 ítems", () => {
    expect(ESCOLAR.CE.map((r) => r.items)).toEqual([6, 6, 6, 7]);
  });

  // Mutación que la mata: cambiar CO[0].items de 7 a 6.
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

  // Mutación que la mata: cambiar EE[0].items de null a 1 o EE[0].letras de 0 a 1.
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
  // Mutación que la mata: cambiar CE1.forma de "RELACIONAR" a "OPCIONES".
  it("Lectura 1 y Auditiva 2 relacionan con diez letras y traen ejemplo", () => {
    for (const regla of [reglaDe("A2_B1_ESCOLAR", "CE", 1)!, reglaDe("A2_B1_ESCOLAR", "CO", 2)!]) {
      expect(regla.forma).toBe("RELACIONAR");
      expect(regla.letras).toBe(10);
      expect(regla.ejemplo).toBe(true);
    }
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 1)!.elementosConTexto).toBe(true);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 2)!.elementosConTexto).toBe(false);
  });

  // Mutación que la mata: cambiar CO3.ejemplo de true a false.
  it("llevan ejemplo exactamente CE1, CO1, CO2 y CO3", () => {
    const conEjemplo = PRUEBAS.flatMap((p) => ESCOLAR[p].filter((r) => r.ejemplo).map((r) => `${p}-${r.numero}`));
    expect(conEjemplo).toEqual(["CE-1", "CO-1", "CO-2", "CO-3"]);
  });

  // Mutación que la mata: cambiar EO2.hermana de 1 a 2.
  it("las orales en directo van con su oral en solitario", () => {
    const eo = (n: number) => reglaDe("A2_B1_ESCOLAR", "EO", n)!;
    expect(eo(2)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 1 });
    expect(eo(4)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 3 });
    expect(eo(1)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: true });
    expect(eo(3)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: false });
  });

  // Mutación que la mata: cambiar CO1.itemsConImagen de 4 a 3.
  it("Auditiva 1 tiene imágenes en las cuatro primeras y Auditiva 4 tres noticias", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 1)!.itemsConImagen).toBe(4);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 4)!.grupos).toBe(3);
  });

  // Mutación que la mata: cambiar CO1.trozos de 8 a 7 (olvidar que el ejemplo suena).
  it("las pistas de auditiva se parten en 8, 7, 1 y 3 trozos, y ninguna otra tarea lleva audio", () => {
    expect(ESCOLAR.CO.map((r) => r.trozos)).toEqual([8, 7, 1, 3]);
    for (const prueba of ["CE", "EE", "EO"] as const) {
      for (const r of ESCOLAR[prueba]) expect(r.trozos).toBeUndefined();
    }
  });
});

describe("los niveles", () => {
  // Mutación que la mata: poner las reglas del escolar también en B1.
  it("solo el escolar tiene reglas hoy", () => {
    expect(nivelesConReglas()).toEqual(["A2_B1_ESCOLAR"]);
    expect(reglaDe("B1", "CE", 1)).toBeNull();
  });

  // Mutación que la mata: añadir { numero: 5, items: 6, ... } a ESCOLAR.CE.
  it("reglaDe devuelve null para una tarea que no existe", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 5)).toBeNull();
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 0)).toBeNull();
  });
});

describe("nombres y etiquetas", () => {
  // Mutación que la mata: cambiar String.fromCharCode(65 + i) a String.fromCharCode(66 + i).
  it("letrasHasta da las letras en orden", () => {
    expect(letrasHasta(3)).toEqual(["A", "B", "C"]);
    expect(letrasHasta(10).at(-1)).toBe("J");
  });

  // Mutación que la mata: quitar CE de PRUEBAS o cambiar el orden de PRUEBAS.
  it("las etiquetas del escolar son las catorce, en orden de prueba", () => {
    expect(etiquetasDeNivel("A2_B1_ESCOLAR")).toEqual([
      "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4",
      "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
    ]);
    expect(etiquetasDeNivel("B2")).toEqual([]);
  });

  // Mutación que la mata: cambiar NOMBRE_CORTO["CE"] de "Lectura" a "Comprensión".
  it("una etiqueta se lee sin jerga", () => {
    expect(nombreDeEtiqueta("CE-3")).toBe("Lectura 3");
    expect(nombreDeEtiqueta("EO-2")).toBe("Oral 2");
  });

  // Mutación que la mata: quitar "CO" de PRUEBAS o cambiar la implementación de esPrueba().
  it("esPrueba solo acepta las cuatro", () => {
    expect(esPrueba("CO")).toBe(true);
    expect(esPrueba("XX")).toBe(false);
  });
});

// Mutación que la mata: escribir `return 24` en puntosDeEscrita. El 24 tiene
// que salir de la estructura, o el día que un nivel tenga otra escrita mentirá.
it("la escrita se corrige sobre las tareas que tiene el nivel", () => {
  expect(puntosDeEscrita("A2_B1_ESCOLAR")).toBe(24);
  expect(puntosDeEscrita("B2")).toBe(0); // sin reglas todavía
  expect(CRITERIOS_EE).toHaveLength(4);
  expect(CRITERIOS_EE.map((c) => c.clave)).toEqual(["adecuacion", "coherencia", "correccion", "alcance"]);
});

// Mutación que la mata: dejar EE en null. El reloj de la escrita es de 50
// minutos, y sin esto la prueba saldría sin reloj y no se entregaría sola.
it("la escrita lleva 50 minutos y la auditiva sigue sin reloj", () => {
  expect(minutosDePrueba("A2_B1_ESCOLAR", "EE")).toBe(50);
  expect(minutosDePrueba("A2_B1_ESCOLAR", "CO")).toBeNull();
});
