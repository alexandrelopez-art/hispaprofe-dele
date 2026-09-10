import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("la base de pruebas", () => {
  it("tiene las tablas de los cimientos", async () => {
    const filas = await prisma.$queryRaw<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `;
    const nombres = filas.map((f) => f.tablename);
    expect(nombres).toContain("Examen");
    expect(nombres).toContain("Tarea");
    expect(nombres).toContain("Pieza");
    expect(nombres).toContain("Actividad");
    expect(nombres).toContain("Clave");
  });
});
