import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("el esqueleto", () => {
  it("define la paleta de la casa en globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("--color-hp-400: #04a1f1;");
    expect(css).toContain("--color-tinta: #143a4f;");
  });
});
