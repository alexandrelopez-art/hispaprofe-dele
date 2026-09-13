import { describe, it, expect } from "vitest";
import { ESTRUCTURAS } from "@/lib/dele/estructura";
import {
  TOPE_DE_TROZOS,
  leerSoluciones,
  resumenDeSoluciones,
  textoDeTrozos,
  trozosSchema,
} from "@/lib/taller/soluciones";
import type { Trozo } from "@/lib/taller/trozos";
import { ANCHO, letraInventada, lineasDeExamen, paginaDeSoluciones } from "./ayudas/cuadernillo-inventado";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

function libroDeDosPaginas(): Trozo[] {
  return [
    ...paginaDeSoluciones(21, lineasDeExamen(1), lineasDeExamen(2)),
    ...paginaDeSoluciones(22, lineasDeExamen(3), lineasDeExamen(4)),
  ];
}

describe("leer la tabla de soluciones", () => {
  // Mutación que la mata: quitar `soluciones[examen] ??= { CE: {}, CO: {} };`
  // (escribir en `soluciones[examen][prueba]` revienta con "Cannot read
  // properties of undefined").
  it("lee cuatro exámenes con 25 respuestas de lectura y 25 de auditiva", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    expect(Object.keys(soluciones).sort()).toEqual(["1", "2", "3", "4"]);
    for (const examen of ["1", "2", "3", "4"]) {
      expect(Object.keys(soluciones[examen].CE)).toHaveLength(25);
      expect(Object.keys(soluciones[examen].CO)).toHaveLength(25);
    }
  });

  // Mutación que la mata: no separar por la mitad de la página (las dos
  // columnas se leen como una y el examen 1 se queda sin nada).
  it("las dos columnas de una página no se mezclan", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    for (const n of [1, 4, 13, 19, 25]) {
      expect(soluciones["1"].CE[String(n)]).toBe(letraInventada(1, "CE", n));
      expect(soluciones["2"].CE[String(n)]).toBe(letraInventada(2, "CE", n));
    }
    expect(soluciones["2"].CO["8"]).toBe(letraInventada(2, "CO", 8));
  });

  // Mutación que la mata: quitar el filtro de páginas con SOLUCIONES.
  it("no lee pares de páginas sin SOLUCIONES", () => {
    const transcripcion: Trozo[] = [
      { pagina: 3, x: 50, y: 700, texto: "EXAMEN 9", anchoPagina: ANCHO },
      { pagina: 3, x: 50, y: 680, texto: "PRUEBA DE COMPRENSIÓN AUDITIVA", anchoPagina: ANCHO },
      { pagina: 3, x: 50, y: 660, texto: "3-B", anchoPagina: ANCHO },
    ];
    expect(leerSoluciones(transcripcion)).toEqual({});
  });

  // Mutación que la mata: no ordenar por altura (se leería en el orden de llegada).
  it("el orden en que llegan los trozos no importa", () => {
    const trozos = libroDeDosPaginas();
    const barajados = trozos.map((t, i) => ({ t, k: (i * 7919) % trozos.length })).sort((a, b) => a.k - b.k).map((x) => x.t);
    expect(leerSoluciones(barajados)).toEqual(leerSoluciones(trozos));
  });

  // Mutación que la mata: quitar la rama `if (/AUDITIVA$/i.test(s)) { prueba
  // = "CO"; ... }` (la prueba se quedaría en CE y CO["20"] saldría undefined).
  it("un rótulo de auditiva cambia de prueba sin cambiar de examen", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    expect(soluciones["3"].CO["20"]).toBe(letraInventada(3, "CO", 20));
    expect(soluciones["3"].CE["20"]).toBe(letraInventada(3, "CE", 20));
  });
});

describe("el resumen de lo entendido", () => {
  // Mutación que la mata: usar `<=` en vez de `<` en el bucle de
  // `encontradas` (la tarea 1, primero=1 items=6, contaría también el 7 —
  // primero de la tarea 2 — y `encontradas` saldría 7 en vez de 6).
  it("un examen completo sale bien", () => {
    const resumen = resumenDeSoluciones(leerSoluciones(libroDeDosPaginas()), ESCOLAR);
    expect(resumen.map((r) => r.examen)).toEqual(["1", "2", "3", "4"]);
    expect(resumen.every((r) => r.bien)).toBe(true);
    expect(resumen[0].pruebas[0].filas.map((f) => f.encontradas)).toEqual([6, 6, 6, 7]);
  });

  // Mutación que la mata: calcular `bien` sin mirar las filas.
  it("una respuesta que falta marca su tarea y el examen", () => {
    const trozos = paginaDeSoluciones(21, lineasDeExamen(1, ["CE-19"]), lineasDeExamen(2));
    const [uno, dos] = resumenDeSoluciones(leerSoluciones(trozos), ESCOLAR);
    expect(uno.bien).toBe(false);
    expect(uno.pruebas[0].filas[3]).toEqual({ tarea: 4, primero: 19, items: 7, encontradas: 6 });
    expect(dos.bien).toBe(true);
  });

  // Mutación que la mata: no calcular `fuera`.
  it("un número que no es de ninguna tarea sale aparte", () => {
    const trozos = paginaDeSoluciones(21, [...lineasDeExamen(1), ["26-A"]], []);
    const [uno] = resumenDeSoluciones(leerSoluciones(trozos), ESCOLAR);
    expect(uno.pruebas[1].fuera).toEqual(["26"]);
    expect(uno.bien).toBe(false);
  });
});

describe("el texto y el tope", () => {
  // Mutación que la mata: quitar el `.sort((a, b) => a.x - b.x)` dentro de la
  // línea (se uniría en el orden de llegada: "mundo Hola" en vez de "Hola
  // mundo").
  it("el texto va por páginas, de arriba abajo y de izquierda a derecha", () => {
    const trozos: Trozo[] = [
      { pagina: 2, x: 50, y: 700, texto: "segunda", anchoPagina: ANCHO },
      { pagina: 1, x: 200, y: 700, texto: "mundo", anchoPagina: ANCHO },
      { pagina: 1, x: 50, y: 700, texto: "Hola", anchoPagina: ANCHO },
      { pagina: 1, x: 50, y: 650, texto: "abajo", anchoPagina: ANCHO },
    ];
    expect(textoDeTrozos(trozos)).toBe("Hola mundo\nabajo\n\nsegunda");
  });

  // Mutación que la mata: quitar (o subir) el `.max(TOPE_DE_TROZOS)` del
  // esquema.
  it("más trozos que el tope, rebota", () => {
    const uno = { pagina: 1, x: 0, y: 0, texto: "x", anchoPagina: ANCHO };
    expect(trozosSchema.safeParse(Array(TOPE_DE_TROZOS + 1).fill(uno)).success).toBe(false);
    expect(trozosSchema.safeParse([uno]).success).toBe(true);
  });
});
