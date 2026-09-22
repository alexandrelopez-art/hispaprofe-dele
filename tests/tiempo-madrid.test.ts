import { describe, it, expect } from "vitest";
import { diasDeRetraso, diasEntre, estaFueraDePlazo, fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

describe("el fin del día en Madrid", () => {
  // Mutación que la mata: calcular en UTC (devolver Date.UTC(...23:59:59.999) sin
  // restar el desfase). En verano el examen caducaría dos horas antes de tiempo.
  it("en verano son las 21:59:59.999 UTC y en invierno las 22:59:59.999", () => {
    expect(finDelDiaEnMadrid("2026-06-20")!.toISOString()).toBe("2026-06-20T21:59:59.999Z");
    expect(finDelDiaEnMadrid("2026-12-20")!.toISOString()).toBe("2026-12-20T22:59:59.999Z");
  });

  // Mutación que la mata: pedir el desfase a medianoche en vez de a mediodía. El
  // 25 de octubre de 2026 el reloj se atrasa a las 03:00: a medianoche todavía es
  // +02:00 y a las 23:59 ya es +01:00, así que preguntar a medianoche da una hora
  // de más justo el día del cambio.
  it("acierta el día en que cambia la hora", () => {
    expect(finDelDiaEnMadrid("2026-10-25")!.toISOString()).toBe("2026-10-25T22:59:59.999Z");
  });

  // Mutación que la mata: quitar la comprobación de que el día existe. Date.UTC
  // convierte el 30 de febrero en el 2 de marzo sin protestar, y el profesor
  // recibiría una fecha que no escribió.
  it("un día que no existe no vale", () => {
    expect(finDelDiaEnMadrid("2026-02-30")).toBeNull();
    expect(finDelDiaEnMadrid("20 de octubre")).toBeNull();
    expect(finDelDiaEnMadrid("")).toBeNull();
  });
});

describe("pintar la fecha", () => {
  // Mutación que la mata: quitar timeZone: HUSO de fechaEnPalabras. Sin él,
  // la suite en UTC vería el día anterior (la tarjeta enseñaría el día incorrecto).
  it("la fecha en palabras sale en hora de Madrid", () => {
    const tope = finDelDiaEnMadrid("2026-10-20")!;
    expect(fechaEnPalabras(tope)).toBe("martes, 20 de octubre de 2026");
    // Prueba aparte con un instante donde el día en Madrid diferente del de UTC.
    // 2026-06-20T22:30:00Z son las 00:30 del 21 en Madrid (UTC+2) pero el 20 en UTC.
    const diferenteDia = new Date("2026-06-20T22:30:00Z");
    expect(fechaEnPalabras(diferenteDia)).toBe("domingo, 21 de junio de 2026");
  });
});

describe("fuera de plazo", () => {
  // Mutación que la mata: usar >= en vez de >, o leer la hora dentro de la
  // función en vez de recibirla.
  it("un milisegundo antes no, un milisegundo después sí", () => {
    const tope = finDelDiaEnMadrid("2026-10-20")!;
    expect(estaFueraDePlazo(tope, new Date(tope.getTime()))).toBe(false);
    expect(estaFueraDePlazo(tope, new Date(tope.getTime() + 1))).toBe(true);
  });
});

describe("días entre dos instantes", () => {
  // Mutación que la mata: dividir milisegundos entre 86.400.000 (redondeando
  // hacia arriba) en vez de contar días de calendario de Madrid. El último
  // domingo de octubre tiene 25 horas: de las 22:00 UTC del 23 (00:00 del 24 en
  // Madrid, CEST) a las 08:00 UTC del 26 (09:00 del 26 en Madrid, ya CET) pasan
  // 58 horas de reloj — Math.ceil(58/24) diría «3 días»; en calendario de
  // Madrid son 2 (del 24 al 26).
  it("los días de espera se cuentan por calendario, no por horas de reloj", () => {
    expect(diasEntre(new Date("2026-10-23T22:00:00Z"), new Date("2026-10-26T08:00:00Z"))).toBe(2);
    // Mismo día de calendario en Madrid (20 de septiembre): 0 días.
    expect(diasEntre(new Date("2026-09-20T10:00:00Z"), new Date("2026-09-20T20:00:00Z"))).toBe(0);
  });
});

describe("días de retraso", () => {
  // El tope de un día cualquiera de septiembre, con una entrega dos días de
  // calendario después, sin cruzar ningún cambio de hora: el caso normal.
  it("cuenta los días de calendario", () => {
    const tope = finDelDiaEnMadrid("2026-09-10")!;
    expect(diasDeRetraso(tope, new Date("2026-09-12T10:00:00Z"))).toBe(2);
  });

  // El último domingo de octubre de 2026 el reloj de Madrid se atrasa una
  // hora (pasa de las 03:00 CEST a las 02:00 CET): ese domingo tiene 25 horas
  // reales, no 24. Tope = fin del 24 de octubre en Madrid (finDelDiaEnMadrid
  // ya lo prueba: "2026-10-24T21:59:59.999Z", con Madrid todavía en +02:00).
  // Entrega = fin del 25 de octubre en Madrid, la misma hora del reloj un día
  // de calendario después, pero con Madrid ya en +01:00: "2026-10-25T22:59:59.999Z".
  // Entre las dos pasan 25 horas de reloj EXACTAS, no 24: dividir milisegundos
  // entre 86 400 000 y redondear hacia arriba (la cuenta vieja) da
  // ceil(25/24) = 2. Un solo día de calendario de Madrid separa el tope de la
  // entrega, así que la cuenta correcta es 1.
  // Mutación que la mata: volver a `Math.ceil((entregadaEn - fechaTope) / 86_400_000)`
  // (milisegundos transcurridos) en vez de contar días del calendario de Madrid.
  it("un día de retraso sigue siendo uno al cruzar el cambio de hora de octubre", () => {
    const tope = new Date("2026-10-24T21:59:59.999Z"); // fin del 24 en Madrid, todavía CEST
    const entrega = new Date("2026-10-25T22:59:59.999Z"); // fin del 25 en Madrid, ya CET
    expect(diasDeRetraso(tope, entrega)).toBe(1);
  });

  // Mismo cambio de hora, pero con dos días de calendario de por medio: la
  // cuenta vieja (milisegundos / 24 h, redondeando hacia arriba) daría 3.
  it("dos días de retraso siguen siendo dos al cruzar el mismo cambio de hora", () => {
    const tope = new Date("2026-10-24T21:59:59.999Z"); // fin del 24 en Madrid, todavía CEST
    const entrega = new Date("2026-10-26T22:59:59.999Z"); // fin del 26 en Madrid, ya CET
    expect(diasDeRetraso(tope, entrega)).toBe(2);
  });

  // Mutación que la mata: quitar el Math.max(1, ...). En el uso real el tope
  // siempre es el final de un día en Madrid, así que una entrega posterior
  // cae ya en el día siguiente; pero la función no depende de esa garantía
  // para no devolver 0 o menos cuando las dos fechas caen el mismo día.
  it("nunca menos de un día, aunque las dos fechas caigan el mismo día de Madrid", () => {
    const tope = new Date("2026-09-10T10:00:00.000Z"); // 12:00 en Madrid, 10 de septiembre
    const entrega = new Date("2026-09-10T11:00:00.000Z"); // 13:00 en Madrid, el mismo día
    expect(diasDeRetraso(tope, entrega)).toBe(1);
  });
});
