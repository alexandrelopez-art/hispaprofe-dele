import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? ficheros(ruta) : ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

describe("la altura de las pantallas del sitio", () => {
  // Mutación que la mata: volver a poner min-h-screen en cualquier pantalla del
  // grupo. Con la cabecera de 64 px encima, min-h-screen hace que TODA pantalla
  // tenga scroll aunque esté vacía.
  it("ninguna pantalla de (sitio) pone min-h-screen", () => {
    const culpables = [...ficheros("app/(sitio)"), "components/examen/corregir-escrita.tsx"].filter((f) =>
      readFileSync(f, "utf8").includes("min-h-screen"),
    );
    expect(culpables).toEqual([]);
  });

  // Mutación que la mata: quitar el flex-1 del contenedor del layout. Sin él las
  // pantallas cortas no llegan al pie y el fondo se corta.
  it("el layout pone la altura: columna a pantalla completa y el contenido ocupa el resto", () => {
    const layout = readFileSync("app/(sitio)/layout.tsx", "utf8");
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("flex-1");
  });

  // Mutación que la mata: borrar cualquiera de los seis ficheros.
  it("Pendientes, Exámenes y Estudiantes tienen su cargando y su error", () => {
    for (const s of ["pendientes", "examenes", "estudiantes"]) {
      expect(existsSync(`app/(sitio)/${s}/loading.tsx`), `${s}/loading`).toBe(true);
      expect(readFileSync(`app/(sitio)/${s}/error.tsx`, "utf8")).toContain("ErrorDePantalla");
    }
  });
});
