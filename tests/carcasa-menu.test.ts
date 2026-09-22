// tests/carcasa-menu.test.ts
import { describe, it, expect } from "vitest";
import { enlacesDe, inicioDe, seccionActiva, usaCabeceraDelExamen } from "@/lib/carcasa/menu";

describe("el menú de cada papel", () => {
  // Mutación que la mata: añadir Practicar (o cualquier sección que no
  // existe) a la lista del estudiante. Se compara la lista ENTERA: con
  // «contiene», una sección de más pasaría en verde.
  it("el estudiante ve exactamente Inicio", () => {
    expect(enlacesDe("ESTUDIANTE").map((e) => [e.href, e.texto])).toEqual([["/", "Inicio"]]);
  });

  // Mutación que la mata: añadir Biblioteca, quitar una, o cambiar el orden.
  it("el profesor ve exactamente Exámenes, Estudiantes y Pendientes", () => {
    expect(enlacesDe("PROFESOR").map((e) => [e.href, e.texto])).toEqual([
      ["/examenes", "Exámenes"],
      ["/estudiantes", "Estudiantes"],
      ["/pendientes", "Pendientes"],
    ]);
  });

  // Mutación que la mata: poner el contador en otro enlace, o en ninguno.
  it("solo Pendientes lleva contador", () => {
    expect(enlacesDe("PROFESOR").filter((e) => e.conContador).map((e) => e.href)).toEqual(["/pendientes"]);
    expect(enlacesDe("ESTUDIANTE").some((e) => e.conContador)).toBe(false);
  });

  // Mutación que la mata: mandar al profesor a "/" (vería un Inicio vacío).
  it("el profesor empieza en Pendientes y el estudiante en Inicio", () => {
    expect(inicioDe("PROFESOR")).toBe("/pendientes");
    expect(inicioDe("ESTUDIANTE")).toBe("/");
  });
});

describe("la sección activa", () => {
  const profesor = enlacesDe("PROFESOR");
  const estudiante = enlacesDe("ESTUDIANTE");

  // Mutación que la mata: comparar solo la ruta exacta (dentro de un examen
  // no se marcaría Exámenes).
  it("se marca también dentro de la sección", () => {
    expect(seccionActiva("/examenes", profesor)).toBe("/examenes");
    expect(seccionActiva("/examenes/abc/CE/1", profesor)).toBe("/examenes");
    expect(seccionActiva("/pendientes/i1", profesor)).toBe("/pendientes");
  });

  // Mutación que la mata: tratar "/" como prefijo (marcaría Inicio en todas).
  it("Inicio solo se marca en /", () => {
    expect(seccionActiva("/", estudiante)).toBe("/");
    expect(seccionActiva("/examen/x1/CE", estudiante)).toBeNull();
  });

  // Mutación que la mata: `startsWith` sin la barra (/examenesX contaría).
  it("un prefijo que no es sección no marca nada", () => {
    expect(seccionActiva("/examenes-viejos", profesor)).toBeNull();
    expect(seccionActiva("/muestrario", profesor)).toBeNull();
  });
});

describe("qué cabecera lleva la pantalla de la prueba", () => {
  // Mutación que la mata: devolver siempre lo mismo.
  it("la del examen mientras no está entregada; la normal después", () => {
    expect(usaCabeceraDelExamen(false)).toBe(true);
    expect(usaCabeceraDelExamen(true)).toBe(false);
  });
});
