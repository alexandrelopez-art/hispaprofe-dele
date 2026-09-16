import { describe, it, expect } from "vitest";
import { estaFueraDePlazo, fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

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
