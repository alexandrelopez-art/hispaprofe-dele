import { describe, it, expect } from "vitest";
import {
  ordenarYEtiquetarPaginas,
  type MarcaDeInicio,
  type SenalDePagina,
} from "@/lib/taller/etiquetas-automaticas";

const NIVEL = "A2_B1_ESCOLAR";
const CABECERA_LECTURA = "PRUEBA DE COMPRENSIÓN DE LECTURA";
const CABECERA_AUDITIVA = "PRUEBA DE COMPRENSIÓN AUDITIVA";

/** Azúcar para las páginas de las pruebas: la cabecera es opcional porque casi ningún caso la necesita. */
function pagina(
  id: string,
  numeroImpreso: number | null,
  inicios: MarcaDeInicio[] = [],
  cabecera: string | null = null,
): SenalDePagina {
  return { id, numeroImpreso, cabecera, inicios };
}

function marca(numero: number, y: number, variante: string | null = null): MarcaDeInicio {
  return { numero, y, variante };
}

function idsEnOrden(resultado: ReturnType<typeof ordenarYEtiquetarPaginas>): string[] {
  return resultado.map((p) => p.id);
}

describe("ordenarYEtiquetarPaginas — caso base sin anomalías (examen 1, páginas 48-58)", () => {
  // Reconstruye e1_p01..p11 de ground-truth-tareas.json con marcas de "TAREA N" plausibles.
  // Sirve de referencia: sin ninguna de las cinco anomalías, todo tiene que
  // salir en su sitio y con `segura: true`.
  const PAGINAS: SenalDePagina[] = [
    pagina("e1_p01", 48, [marca(1, 0.95)]),
    pagina("e1_p02", 49, []),
    pagina("e1_p03", 50, [marca(2, 0.95)]),
    pagina("e1_p04", 51, [marca(3, 0.4)]),
    pagina("e1_p05", 52, []),
    pagina("e1_p06", 53, [marca(4, 0.95)]),
    pagina("e1_p07", 54, [marca(1, 0.95)]),
    pagina("e1_p08", 55, [marca(2, 0.4)]),
    pagina("e1_p09", 56, [marca(3, 0.95), marca(4, 0.4)]),
    pagina("e1_p10", 57, [marca(1, 0.4)]),
    pagina("e1_p11", 58, [marca(2, 0.4)]),
  ];
  const ESPERADAS: string[][] = [
    ["CE-1"],
    ["CE-1"],
    ["CE-2"],
    ["CE-2", "CE-3"],
    ["CE-3"],
    ["CE-4"],
    ["CO-1"],
    ["CO-1", "CO-2"],
    ["CO-3", "CO-4"],
    ["CO-4", "EE-1"],
    ["EE-1", "EE-2"],
  ];

  it("respeta el orden de entrada cuando ya viene bien y etiqueta cada página como en el cuadernillo real", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    expect(idsEnOrden(resultado)).toEqual(PAGINAS.map((p) => p.id));
    expect(resultado.map((p) => p.etiquetas)).toEqual(ESPERADAS);
  });

  // Anomalía 5: 6 de las 11 páginas cargan más de una tarea (fin de una +
  // principio de otra, o dos tareas cortas de CO enteras en la misma página).
  it("marca como seguras las páginas con dos tareas, no solo las de una", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const conDosOMas = resultado.filter((p) => p.etiquetas.length > 1);
    expect(conDosOMas.length).toBeGreaterThanOrEqual(4);
    expect(conDosOMas.every((p) => p.segura)).toBe(true);
  });

  it("no encuentra ninguna página insegura cuando todo casa", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    expect(resultado.every((p) => p.segura)).toBe(true);
  });

  // Un mismo dígito de rótulo ("1", "2"...) aparece en CE, CO y EE: la
  // resolución tiene que venir de la posición en la secuencia, nunca del
  // número suelto. Mutación que la mata: casar por número más próximo sin
  // avanzar el puntero, o buscar desde el principio en vez de desde `idx+1`.
  it("no confunde CO-1 con CE-1 solo porque los dos rótulos dicen «1»", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    expect(resultado.find((p) => p.id === "e1_p07")!.etiquetas).toEqual(["CO-1"]);
  });
});

describe("ordenarYEtiquetarPaginas — anomalía 1: el orden del PDF no es el orden del libro", () => {
  // Reconstruye el examen 6 completo: en el PDF real, el primer pliego
  // (e6_p01) es la ÚLTIMA tirada del libro (páginas 130-131, la parte oral);
  // el resto del PDF (e6_p02..p07) son las páginas 118-129, anteriores. El
  // array de entrada respeta ese orden de archivo, no el del libro.
  const PAGINAS: SenalDePagina[] = [
    pagina("e6_p01_izq", 130, [marca(3, 0.4)]),
    pagina("e6_p01_der", 131, [marca(4, 0.4)]),
    pagina("e6_p02_izq", 118, [marca(1, 0.95)]),
    pagina("e6_p02_der", 119, []),
    pagina("e6_p03_izq", 120, [marca(2, 0.95)]),
    pagina("e6_p03_der", 121, [marca(3, 0.4)]),
    pagina("e6_p04_izq", 122, []),
    pagina("e6_p04_der", 123, [marca(4, 0.95)]),
    pagina("e6_p05_izq", 124, [marca(1, 0.95)]),
    pagina("e6_p05_der", 125, [marca(2, 0.4)]),
    pagina("e6_p06_izq", 126, [marca(3, 0.95), marca(4, 0.4)]),
    pagina("e6_p06_der", 127, [marca(1, 0.4)]),
    pagina("e6_p07_izq", 128, [marca(2, 0.4)]),
    pagina("e6_p07_der", 129, [marca(1, 0.95), marca(2, 0.4)]),
  ];

  it("reordena por el número de página impreso y no por la posición en el PDF", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    // El pliego que en el PDF viene primero acaba el último: 118..131 en orden de libro.
    expect(idsEnOrden(resultado)).toEqual([
      "e6_p02_izq", "e6_p02_der", "e6_p03_izq", "e6_p03_der",
      "e6_p04_izq", "e6_p04_der", "e6_p05_izq", "e6_p05_der",
      "e6_p06_izq", "e6_p06_der", "e6_p07_izq", "e6_p07_der",
      "e6_p01_izq", "e6_p01_der",
    ]);
  });

  it("etiqueta bien todas las páginas de lectura, auditiva y escrita, ajenas al reordenamiento", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const porId = new Map(resultado.map((p) => [p.id, p]));
    expect(porId.get("e6_p02_izq")!.etiquetas).toEqual(["CE-1"]);
    expect(porId.get("e6_p03_der")!.etiquetas).toEqual(["CE-2", "CE-3"]);
    expect(porId.get("e6_p06_izq")!.etiquetas).toEqual(["CO-3", "CO-4"]);
    expect(porId.get("e6_p07_der")!.etiquetas).toEqual(["EO-1", "EO-2"]);
    expect(porId.get("e6_p01_der")!.etiquetas).toEqual(["EO-3", "EO-4"]);
  });

  // EO-1 y EO-2 son tareas «hermanas» (se graban en la misma conversación,
  // ver `hermana` en estructura.ts) y el libro a veces repite la etiqueta de
  // la primera varias páginas después de que ya se diera por cerrada. Aquí
  // e6_p07_der confirmó las DOS con rótulo propio («TAREA 1» y «TAREA 2»),
  // así que cuando e6_p01_izq hereda de la más reciente (EO-2) porque su
  // rótulo de EO-3 no está pegado al borde superior, arrastra también la
  // hermana repescada en vez de perderla en silencio.
  it("reconstruye el EO-1 repescado en la página que empalma con EO-3, porque las dos hermanas ya se habían confirmado", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const p01izq = resultado.find((p) => p.id === "e6_p01_izq")!;
    expect(p01izq.etiquetas).toEqual(["EO-1", "EO-2", "EO-3"]);
    expect(p01izq.segura).toBe(true);
  });
});

describe("ordenarYEtiquetarPaginas — hermanas orales repescadas: generalización y límite", () => {
  // Recorre CE-1..CE-4, CO-1..CO-4, EE-1..EE-2 en una sola página con diez
  // rótulos, de arriba a abajo, para llegar al bloque EO con el puntero en
  // EE-2 sin tener que montar catorce páginas de relleno.
  const AVANCE_HASTA_EE2: MarcaDeInicio[] = [
    marca(1, 0.99), marca(2, 0.98), marca(3, 0.97), marca(4, 0.96),
    marca(1, 0.95), marca(2, 0.94), marca(3, 0.93), marca(4, 0.92),
    marca(1, 0.91), marca(2, 0.9),
  ];

  // Analogía de la anomalía 1 con el otro par de hermanas (EO-3/EO-4, en vez
  // de EO-1/EO-2): al ser las dos últimas tareas de la secuencia no hay una
  // "EO-5" que reabra el hueco con un rótulo nuevo, así que la reimpresión se
  // ve en una página de cierre sin ningún rótulo propio. Antes del arreglo
  // esa página solo heredaba EO-4 y perdía EO-3 en silencio.
  it("arrastra también EO-3 en la página final que reimprime el cierre de las dos hermanas", () => {
    const paginas: SenalDePagina[] = [
      pagina("arranque", 1, AVANCE_HASTA_EE2),
      pagina("abre-eo3", 2, [marca(3, 0.95)]),
      pagina("abre-eo4", 3, [marca(4, 0.95)]),
      pagina("cierre-repescado", 4, []),
    ];
    const resultado = ordenarYEtiquetarPaginas(NIVEL, paginas);
    const cierre = resultado.find((p) => p.id === "cierre-repescado")!;
    expect(cierre.etiquetas).toEqual(["EO-3", "EO-4"]);
    expect(cierre.segura).toBe(true);
  });

  // Si la hermana (EO-1) nunca apareció con su propio rótulo — aquí el
  // puntero salta directo de EE-2 a EO-2 porque no hay ninguna marca "TAREA
  // 1" en el bloque oral — no hay que inventarla: puede que este cuadernillo
  // en concreto no la traiga. La página de cierre solo hereda EO-2, como
  // antes del arreglo.
  it("no inventa la hermana cuando esta nunca se confirmó con su propio rótulo", () => {
    const paginas: SenalDePagina[] = [
      pagina("arranque", 1, AVANCE_HASTA_EE2),
      pagina("abre-eo2-directo", 2, [marca(2, 0.95)]), // salta EO-1 sin rótulo propio
      pagina("cierre-vacio", 3, []),
    ];
    const resultado = ordenarYEtiquetarPaginas(NIVEL, paginas);
    const cierre = resultado.find((p) => p.id === "cierre-vacio")!;
    expect(cierre.etiquetas).toEqual(["EO-2"]);
    expect(cierre.segura).toBe(true);
  });
});

describe("ordenarYEtiquetarPaginas — anomalía 2: un pie de página que falta del todo", () => {
  // Reconstruye e3_p01..p06: el pliego e3_p03 no lleva pie de página en
  // ninguna de sus dos caras (76,77,78,79,null,null,82,83,...). Los números
  // vecinos (79 y 82) dejan un hueco de tamaño 2 justo del tamaño de las dos
  // páginas sin pie.
  const PAGINAS: SenalDePagina[] = [
    pagina("e3_p01_izq", 76, [marca(1, 0.95)]),
    pagina("e3_p01_der", 77, []),
    pagina("e3_p02_izq", 78, [marca(2, 0.95)]),
    pagina("e3_p02_der", 79, [marca(3, 0.4)]),
    pagina("e3_p03_izq", null, [marca(4, 0.4)]),
    pagina("e3_p03_der", null, [marca(1, 0.4)]),
    pagina("e3_p04_izq", 82, []),
    pagina("e3_p04_der", 83, [marca(2, 0.95), marca(3, 0.4)]),
    pagina("e3_p05_izq", 84, [marca(4, 0.95)]),
    pagina("e3_p05_der", 85, [marca(1, 0.95), marca(2, 0.4)]),
    pagina("e3_p06_izq", 86, [marca(1, 0.4)]),
    pagina("e3_p06_der", 87, [marca(2, 0.4)]),
  ];

  it("coloca las dos páginas sin pie en el único hueco de número que encajan", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    expect(idsEnOrden(resultado)).toEqual([
      "e3_p01_izq", "e3_p01_der", "e3_p02_izq", "e3_p02_der",
      "e3_p03_izq", "e3_p03_der",
      "e3_p04_izq", "e3_p04_der", "e3_p05_izq", "e3_p05_der", "e3_p06_izq", "e3_p06_der",
    ]);
  });

  it("les da las etiquetas correctas y las da por seguras, no por adivinadas", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const porId = new Map(resultado.map((p) => [p.id, p]));
    expect(porId.get("e3_p03_izq")!.etiquetas).toEqual(["CE-3", "CE-4"]);
    expect(porId.get("e3_p03_der")!.etiquetas).toEqual(["CE-4", "CO-1"]);
    expect(porId.get("e3_p03_izq")!.segura).toBe(true);
    expect(porId.get("e3_p03_der")!.segura).toBe(true);
  });

  it("las páginas siguientes al hueco no se ven afectadas", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const porId = new Map(resultado.map((p) => [p.id, p]));
    expect(porId.get("e3_p04_izq")!.etiquetas).toEqual(["CO-1"]);
    expect(porId.get("e3_p06_der")!.etiquetas).toEqual(["EO-1", "EO-2"]);
    expect(resultado.every((p) => p.segura)).toBe(true);
  });
});

describe("ordenarYEtiquetarPaginas — anomalía 3: una cabecera mal impresa", () => {
  // El examen 4 real trae una página cuya cabecera dice «... DE LECTURA»
  // aunque el contenido es de la auditiva (misprint del libro). Aquí se
  // reproduce con una página cuya cabecera insiste en CE cuando, por su
  // posición en la secuencia (justo después de que ya se abriera CO-1), solo
  // puede ser CO-2.
  const PAGINAS: SenalDePagina[] = [
    pagina("p1", 1, [marca(1, 0.95)], CABECERA_LECTURA),
    pagina("p2", 2, [marca(2, 0.95)], CABECERA_LECTURA),
    pagina("p3", 3, [marca(3, 0.95)], CABECERA_LECTURA),
    pagina("p4", 4, [marca(4, 0.95)], CABECERA_LECTURA),
    pagina("p5", 5, [marca(1, 0.95)], CABECERA_AUDITIVA),
    pagina("p6", 6, [marca(2, 0.4)], CABECERA_LECTURA), // cabecera de imprenta equivocada
  ];

  // Mutación que la mata: resolver la prueba de la tarea a partir de
  // `cabecera` en vez de a partir de la posición en la secuencia.
  it("ignora la cabecera y etiqueta por la posición en la secuencia (CO-2, no CE-2)", () => {
    const resultado = ordenarYEtiquetarPaginas(NIVEL, PAGINAS);
    const p6 = resultado.find((p) => p.id === "p6")!;
    expect(p6.etiquetas).toEqual(["CO-1", "CO-2"]);
    expect(p6.segura).toBe(true);
  });
});

describe("ordenarYEtiquetarPaginas — anomalía 4: al rótulo le falta el sufijo «(OPCIÓN N)»", () => {
  function construir(variante: string | null): SenalDePagina[] {
    return [pagina("a", 1, [marca(1, 0.95)]), pagina("b", 2, [marca(2, 0.95, variante)])];
  }

  // Mutación que la mata: leer `variante` para decidir la tarea en vez de mirar solo `numero`.
  it("da la misma etiqueta lleve o no lleve el sufijo, porque solo se mira el número", () => {
    const conSufijo = ordenarYEtiquetarPaginas(NIVEL, construir("(OPCIÓN 1)"));
    const sinSufijo = ordenarYEtiquetarPaginas(NIVEL, construir(null));
    expect(conSufijo.map((p) => p.etiquetas)).toEqual(sinSufijo.map((p) => p.etiquetas));
    expect(sinSufijo.find((p) => p.id === "b")!.etiquetas).toEqual(["CE-2"]);
  });
});

describe("ordenarYEtiquetarPaginas — ambigüedad genuina: avisa en vez de adivinar", () => {
  it("dos páginas de relleno sin pie ni rótulo, en el mismo hueco, quedan marcadas para revisar", () => {
    const paginas: SenalDePagina[] = [
      pagina("ancla-1", 10, [marca(1, 0.95)]), // CE-1
      pagina("relleno-1", null, []),
      pagina("relleno-2", null, []),
      pagina("ancla-2", 13, [marca(2, 0.95)]), // CE-2
    ];
    const resultado = ordenarYEtiquetarPaginas(NIVEL, paginas);
    const porId = new Map(resultado.map((p) => [p.id, p]));

    // El hueco es del tamaño justo (10, [11], [12], 13) así que se colocan
    // ahí, pero ninguna trae una marca que diga cuál va primero: sin
    // adivinar, ambas quedan sin confirmar.
    expect(idsEnOrden(resultado)).toEqual(["ancla-1", "relleno-1", "relleno-2", "ancla-2"]);
    expect(porId.get("relleno-1")!.segura).toBe(false);
    expect(porId.get("relleno-2")!.segura).toBe(false);
    expect(porId.get("ancla-1")!.segura).toBe(true);
    expect(porId.get("ancla-2")!.segura).toBe(true);
  });

  it("sin ningún número impreso en todo el documento, no hay ancla y todo se marca para revisar", () => {
    const paginas: SenalDePagina[] = [
      pagina("x", null, [marca(1, 0.95)]),
      pagina("y", null, [marca(2, 0.4)]),
    ];
    const resultado = ordenarYEtiquetarPaginas(NIVEL, paginas);
    expect(idsEnOrden(resultado)).toEqual(["x", "y"]);
    expect(resultado.every((p) => !p.segura)).toBe(true);
  });
});

describe("ordenarYEtiquetarPaginas — nivel sin estructura todavía", () => {
  // Mutación que la mata: devolver `segura: true` o inventar etiquetas cuando `ESTRUCTURAS[nivel]` es null.
  it("no inventa nada: sin secuencia contra la que casar, todo va vacío e inseguro", () => {
    const paginas: SenalDePagina[] = [pagina("x", 1, [marca(1, 0.95)]), pagina("y", 2, [])];
    const resultado = ordenarYEtiquetarPaginas("A1", paginas);
    expect(idsEnOrden(resultado)).toEqual(["x", "y"]);
    expect(resultado.every((p) => p.etiquetas.length === 0 && !p.segura)).toBe(true);
  });
});
