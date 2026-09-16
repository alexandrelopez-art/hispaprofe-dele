import { describe, it, expect } from "vitest";
import { minutosDePrueba } from "@/lib/dele/estructura";
import {
  estadoDePrueba,
  notaDePrueba,
  seAcaboElTiempo,
  segundosQueQuedan,
  siguienteTrozo,
  textoDelEstado,
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

  // Mutación que la mata: quitar los diez segundos de gracia, o comparar con >.
  it("los diez segundos de gracia son diez, no cero y no veinte", () => {
    expect(seAcaboElTiempo(EMPEZO, 50, en(49, 59))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 5))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 11))).toBe(true);
    // Justo en el límite: con >= esto daría true, y por eso la mutación muere aquí.
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 10))).toBe(false);
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
