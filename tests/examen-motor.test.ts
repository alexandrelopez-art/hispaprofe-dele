import { describe, it, expect } from "vitest";
import { minutosDePrueba } from "@/lib/dele/estructura";
import {
  estadoDePrueba,
  estaEntregada,
  limitesDelTrozo,
  notaDePrueba,
  palabras,
  seAcaboElTiempo,
  segundosQueQuedan,
  siguienteTrozo,
  huboSalidas,
  sumaDeBandas,
  textoDelEstado,
  tiempoFueraEnPalabras,
  vecesEnPalabras,
} from "@/lib/examen/motor";

// Clave inventada de seis preguntas: el cuadernillo real no entra en el repo.
const CLAVE = { "1": "A", "2": "B", "3": "C", "4": "A", "5": "B", "6": "C" };

describe("la nota", () => {
  // Mutación que la mata: contar como acierto lo no marcado, o devolver un total fijo.
  it("cuenta aciertos, dice los fallos y no regala las no marcadas", () => {
    const nota = notaDePrueba(CLAVE, { "1": "A", "2": "C", "3": "C", "5": "A" });
    expect(nota.aciertos).toBe(2);
    expect(nota.total).toBe(6);
    expect(nota.fallos).toEqual([
      { numero: 2, marcada: "C" },
      { numero: 4, marcada: null },
      { numero: 5, marcada: "A" },
      { numero: 6, marcada: null },
    ]);
  });

  // Mutación que la mata: comparar sin normalizar. El desplegable manda "a"
  // minúscula en algún navegador y el estudiante perdería la pregunta.
  it("la letra vale igual en minúscula y con espacios", () => {
    expect(notaDePrueba(CLAVE, { "1": " a " }).aciertos).toBe(1);
  });

  // Mutación que la mata: puntuar por lo que mandó el estudiante en vez de por la
  // clave. Una respuesta a una pregunta que no existe no puede sumar.
  it("una respuesta de más ni suma ni cuenta", () => {
    const nota = notaDePrueba(CLAVE, { "1": "A", "99": "A" });
    expect(nota.aciertos).toBe(1);
    expect(nota.total).toBe(6);
    expect(nota.fallos.some((f) => f.numero === 99)).toBe(false);
  });

  // Mutación que la mata: sacar el total de las respuestas del estudiante en vez de la clave: sin clave daría total 1.
  it("sin clave no hay nota que dar", () => {
    expect(notaDePrueba({}, { "1": "A" })).toEqual({ aciertos: 0, total: 0, fallos: [] });
  });
});

const EMPEZO = new Date("2026-09-20T09:00:00Z");
const ENTREGADA = new Date("2026-09-20T09:40:00Z");
const en = (minutos: number, segundos = 0) => new Date(EMPEZO.getTime() + minutos * 60_000 + segundos * 1_000);

describe("el reloj", () => {
  // Mutación que la mata: redondear hacia arriba, o contar desde «ahora».
  it("descuenta desde que empezó", () => {
    expect(segundosQueQuedan(EMPEZO, 50, EMPEZO)).toBe(3000);
    expect(segundosQueQuedan(EMPEZO, 50, en(49))).toBe(60);
    expect(segundosQueQuedan(EMPEZO, 50, en(51))).toBe(0);
    // Medio segundo: con Math.ceil esto daría 60, y por eso la mutación muere aquí.
    expect(segundosQueQuedan(EMPEZO, 50, en(49, 0.5))).toBe(59);
  });

  // Mutación que la mata: devolver 0 en vez de null; la auditiva pintaría un
  // reloj parado en cero y parecería que se acabó el tiempo.
  it("sin minutos no hay reloj", () => {
    expect(segundosQueQuedan(EMPEZO, null, en(600))).toBeNull();
    expect(seAcaboElTiempo(EMPEZO, null, en(600))).toBe(false);
  });

  // Mutación que la mata: quitar los diez segundos de gracia, o comparar con
  // `>=` (la implementación compara con `>`, así que nombrar `>` no sería
  // ninguna mutación: es lo que ya hay escrito).
  it("los diez segundos de gracia son diez, no cero y no veinte", () => {
    expect(seAcaboElTiempo(EMPEZO, 50, en(49, 59))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 5))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 11))).toBe(true);
    // Justo en el límite: con >= esto daría true, y por eso la mutación muere aquí.
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 10))).toBe(false);
  });
});

describe("el registro de salidas, en palabras", () => {
  const sinSalidas = {
    salidas: 0,
    segundosFuera: 0,
    ultimaSalidaEn: null,
    ultimaSalidaDeTarea: null,
    ultimaSalidaSinVuelta: false,
  };

  // Mutación que la mata: mirar `segundosFuera > 0` en vez de `salidas > 0`.
  // Tres salidas de un segundo cada una son tres salidas y el profesor tiene que
  // verlas; con los segundos redondeados podrían dar cero y desaparecería la
  // línea entera.
  it("solo hay algo que contar si hubo salidas, no si hubo segundos", () => {
    expect(huboSalidas(sinSalidas)).toBe(false);
    expect(huboSalidas({ ...sinSalidas, salidas: 1, segundosFuera: 0 })).toBe(true);
    expect(huboSalidas({ ...sinSalidas, salidas: 3, segundosFuera: 240 })).toBe(true);
  });

  // Mutación que la mata: dar siempre los segundos en crudo, o redondear también
  // por debajo del minuto (5 segundos saldrían «0 minutos»). La diferencia entre
  // «5 segundos» y «55 segundos» es justo la que le dice al profesor si fue una
  // notificación o una consulta.
  it("por debajo del minuto van segundos; por encima, minutos redondeados", () => {
    expect(tiempoFueraEnPalabras(0)).toBe("0 segundos");
    expect(tiempoFueraEnPalabras(5)).toBe("5 segundos");
    expect(tiempoFueraEnPalabras(59)).toBe("59 segundos");
    expect(tiempoFueraEnPalabras(60)).toBe("1 minuto");
    expect(tiempoFueraEnPalabras(95)).toBe("2 minutos");
    expect(tiempoFueraEnPalabras(240)).toBe("4 minutos");
  });

  // Mutación que la mata: plural fijo. «1 segundos» y «1 veces» en la pantalla
  // del profesor, y la línea la lee él cada vez que corrige.
  it("el singular es singular", () => {
    expect(tiempoFueraEnPalabras(1)).toBe("1 segundo");
    expect(vecesEnPalabras(1)).toBe("1 vez");
    expect(vecesEnPalabras(2)).toBe("2 veces");
    expect(vecesEnPalabras(0)).toBe("0 veces");
  });
});

describe("qué trozo toca", () => {
  // Mutación que la mata: devolver oidos.length + 1, que parece lo mismo y
  // falla en cuanto hay un hueco.
  it("el menor que no ha sonado, aunque haya huecos", () => {
    expect(siguienteTrozo([], 8)).toBe(1);
    expect(siguienteTrozo([1, 2], 8)).toBe(3);
    expect(siguienteTrozo([1, 3], 8)).toBe(2);
    expect(siguienteTrozo([1, 2, 3, 4, 5, 6, 7, 8], 8)).toBeNull();
  });

  // Mutación que la mata: tratar trozos = 1 como «sin trozos» y devolver siempre null: la auditiva 3 no sonaría nunca.
  it("una tarea que no se corta es un solo trozo", () => {
    expect(siguienteTrozo([], 1)).toBe(1);
    expect(siguienteTrozo([1], 1)).toBeNull();
  });
});

describe("de dónde a dónde suena un trozo", () => {
  // Mutación que la mata: cambiar las ramas del ternario de `hasta` (poner
  // `cortes[trozo - 1]` en el último y `null` en los demás): el último
  // devolvería `cortes[2]`, fuera de rango, en vez de `null`.
  it("el último suena hasta el final del fichero", () => {
    expect(limitesDelTrozo([113, 195], 3)).toEqual({ desde: 195, hasta: null });
  });

  // Mutación que la mata: quitar el caso especial `trozo === 1` y calcular
  // igual que los demás (`cortes[trozo - 2]`): sería `cortes[-1]`, `undefined`,
  // en vez de `0`.
  it("el primero empieza en cero", () => {
    expect(limitesDelTrozo([113, 195], 1)).toEqual({ desde: 0, hasta: 113 });
  });

  // Mutación que la mata: confundir el índice con el número de trozo
  // (`cortes[trozo - 1]` en vez de `cortes[trozo - 2]`): el trozo 2 empezaría
  // en 195, la marca siguiente, no en 113.
  it("los de en medio van de marca a marca", () => {
    expect(limitesDelTrozo([113, 195], 2)).toEqual({ desde: 113, hasta: 195 });
  });

  // Mutación que la mata: comparar con `cortes.length` en vez de
  // `cortes.length + 1` para decidir si es el último. Con cero marcas eso
  // daría `esElUltimo = false` y el trozo único no llegaría a sonar hasta el final.
  it("una tarea sin marcas es un solo trozo, la pista entera", () => {
    expect(limitesDelTrozo([], 1)).toEqual({ desde: 0, hasta: null });
  });
});

describe("cómo se llama lo que ha hecho", () => {
  // Mutación que la mata: llamar «Entregada» a un intento sin entregar.
  it("sin empezar, a medias y entregada", () => {
    expect(textoDelEstado(estadoDePrueba(null))).toBe("Sin empezar");
    expect(textoDelEstado(estadoDePrueba({ entregadaEn: null, aciertos: null, total: null, porTiempo: false }))).toBe("A medias");
    expect(
      textoDelEstado(estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 19, total: 25, porTiempo: false })),
    ).toBe("Entregada, 19 de 25");
  });

  // Mutación que la mata: no distinguir la que entregó el reloj. El profesor
  // tiene que poder ver que ese 12 de 25 es de alguien a quien se le acabó.
  it("dice cuándo la entregó el reloj", () => {
    expect(
      textoDelEstado(estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 12, total: 25, porTiempo: true })),
    ).toBe("Entregada por tiempo, 12 de 25");
  });
});

describe("los minutos de cada prueba", () => {
  // Mutación que la mata: poner 30 minutos en la auditiva. Las cuatro pistas del
  // libro duran más que eso y el estudiante se quedaría cortado sin culpa suya.
  it("la lectura lleva reloj y la auditiva no", () => {
    expect(minutosDePrueba("A2_B1_ESCOLAR", "CE")).toBe(50);
    expect(minutosDePrueba("A2_B1_ESCOLAR", "CO")).toBeNull();
  });

  // Mutación que la mata: devolver 50 por defecto para cualquier nivel: un examen de B2 saldría con reloj sin que nadie lo haya decidido.
  it("un nivel sin números no inventa minutos", () => {
    expect(minutosDePrueba("B2", "CE")).toBeNull();
  });
});

describe("contar palabras", () => {
  // Mutación que la mata: `texto.split(" ").length`. Con dos espacios seguidos,
  // con un salto de línea o con el texto vacío, esa cuenta miente — y es el
  // número que el estudiante ve mientras escribe y el que se guarda.
  it("cuenta lo que cuenta una persona", () => {
    expect(palabras("")).toBe(0);
    expect(palabras("   ")).toBe(0);
    expect(palabras("Hola")).toBe(1);
    expect(palabras("Hola,  qué   tal")).toBe(3);
    expect(palabras("Hola\nqué tal\n\nadiós")).toBe(4);
    expect(palabras("  Hola qué tal  ")).toBe(3);
    // Una palabra con guion es una palabra, y un signo pegado no suma.
    expect(palabras("teórico-práctico ¿sí?")).toBe(2);
  });
});

describe("la suma de las bandas", () => {
  // Mutación que la mata: sumar solo el primer escrito, o dar por hecho que
  // siempre hay cuatro bandas. La escrita son DOS tareas: sumar una sola
  // dejaría a todo el mundo con la mitad de su nota.
  it("suma las bandas de todas las tareas", () => {
    expect(sumaDeBandas([{ bandas: [3, 2, 1, 0] }, { bandas: [3, 3, 2, 2] }])).toBe(16);
    expect(sumaDeBandas([])).toBe(0);
    expect(sumaDeBandas([{ bandas: [] }, { bandas: [1, 1, 1, 1] }])).toBe(4);
  });
});

describe("el estado de una escrita", () => {
  // Mutación que la mata: devolver "ENTREGADA" cuando no hay nota. Entonces la
  // pantalla del profesor diría «Entregada,» a secas y la del estudiante
  // intentaría pintarle una nota que todavía no existe.
  it("entregada y sin nota es esperando corrección", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: null, total: null, porTiempo: false });
    expect(e.estado).toBe("ESPERANDO");
    expect(textoDelEstado(e)).toBe("Entregada, esperando corrección");
    expect(estaEntregada(e)).toBe(true);
  });

  // Mutación que la mata: quitar `porTiempo` del texto de ESPERANDO. Es la
  // única señal que tiene el profesor de a quién se le acabó el tiempo, y en la
  // escrita importa más que en ninguna: explica un texto a medias.
  it("dice si la entregó el reloj", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: null, total: null, porTiempo: true });
    expect(textoDelEstado(e)).toBe("Entregada por tiempo, esperando corrección");
  });

  // Mutación que la mata: dejar ESPERANDO cuando ya hay nota. Una escrita
  // corregida se quedaría para siempre en la cola.
  it("corregida ya tiene nota y sale de la espera", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 18, total: 24, porTiempo: false });
    expect(e.estado).toBe("ENTREGADA");
    expect(textoDelEstado(e)).toBe("Entregada, 18 de 24");
  });
});
