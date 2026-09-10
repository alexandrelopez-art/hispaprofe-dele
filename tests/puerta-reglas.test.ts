import { describe, it, expect } from "vitest";
import {
  motivoParaRechazar,
  sesionCaducada,
  hayQueFrenar,
  caducidadDelEnlace,
} from "@/lib/puerta/reglas";

const AHORA = new Date("2026-09-10T12:00:00Z");
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);

describe("las reglas de la entrada", () => {
  it("acepta un enlace vivo y sin usar", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(5), usadoEn: null }, AHORA)).toBeNull();
  });

  it("rechaza un enlace caducado", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(-1), usadoEn: null }, AHORA)).toBe("caducado");
  });

  it("rechaza un enlace ya usado, aunque siga vivo", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(5), usadoEn: minutos(-2) }, AHORA)).toBe("usado");
  });

  it("el enlace caduca a los quince minutos", () => {
    expect(caducidadDelEnlace(AHORA).toISOString()).toBe(minutos(15).toISOString());
  });

  it("una sesión caducada no vale", () => {
    expect(sesionCaducada({ expiraEn: minutos(-1) }, AHORA)).toBe(true);
    expect(sesionCaducada({ expiraEn: minutos(1) }, AHORA)).toBe(false);
  });

  it("frena a la sexta petición dentro de la ventana", () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => minutos(-n));
    expect(hayQueFrenar(cinco, AHORA)).toBe(true);
    expect(hayQueFrenar(cinco.slice(1), AHORA)).toBe(false);
  });

  it("no cuenta las peticiones de fuera de la ventana", () => {
    const viejas = [16, 17, 18, 19, 20].map((n) => minutos(-n));
    expect(hayQueFrenar(viejas, AHORA)).toBe(false);
  });
});
