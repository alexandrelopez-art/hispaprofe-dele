import { describe, it, expect } from "vitest";
import { crearSecreto, huellaDe } from "@/lib/puerta/secretos";

describe("los secretos", () => {
  it("nunca da dos veces el mismo", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => crearSecreto().secreto));
    expect(vistos.size).toBe(200);
  });

  it("la huella no contiene el secreto", () => {
    const { secreto, huella } = crearSecreto();
    expect(huella).not.toContain(secreto);
    expect(huella).toHaveLength(64);
  });

  it("la huella del mismo secreto siempre es la misma", () => {
    const { secreto, huella } = crearSecreto();
    expect(huellaDe(secreto)).toBe(huella);
  });
});
