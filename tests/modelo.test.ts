import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const esquema = readFileSync("prisma/schema.prisma", "utf8");

/** Quita los comentarios para que una prueba no encuentre lo que busca dentro de uno. */
function sinComentarios(texto: string): string {
  return texto
    .split("\n")
    .map((linea) => linea.replace(/\/\/.*$/, "").replace(/^\s*\/\/\/.*$/, ""))
    .join("\n");
}

const limpio = sinComentarios(esquema);

describe("el modelo", () => {
  it("no limita el número de actividades por tarea", () => {
    expect(limpio).not.toContain("@@unique([tareaId])");
    expect(limpio).not.toContain("@@unique([pasoId])");
  });

  it("ordena las piezas dentro de la tarea y no deja dos en el mismo sitio", () => {
    expect(limpio).toContain("@@unique([tareaId, orden])");
  });

  it("guarda las respuestas en una tabla aparte de la actividad", () => {
    expect(limpio).toMatch(/model Clave \{[\s\S]*respuestas\s+Json/);
    const actividad = limpio.match(/model Actividad \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(actividad).not.toContain("respuestas");
  });

  it("no usa la jerga vieja en ningún nombre de modelo", () => {
    for (const palabra of ["model Recorrido", "model Paso", "model Sujeto"]) {
      expect(limpio).not.toContain(palabra);
    }
  });
});
