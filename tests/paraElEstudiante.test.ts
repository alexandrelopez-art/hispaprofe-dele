import { describe, it, expect } from "vitest";
import { actividadParaElEstudiante } from "@/lib/examen/paraElEstudiante";

const conClave = {
  id: "act1",
  tipo: "OPCION" as const,
  datos: { preguntas: [{ id: "p1", enunciado: "¿Quién no trabaja todavía?" }] },
  clave: { id: "c1", respuestas: { p1: "B" } },
};

describe("lo que se le manda al estudiante", () => {
  it("conserva el enunciado y las opciones", () => {
    const publica = actividadParaElEstudiante(conClave);
    expect(publica.id).toBe("act1");
    expect(publica.tipo).toBe("OPCION");
    expect(publica.datos).toEqual(conClave.datos);
  });

  it("no lleva la clave por ningún lado", () => {
    const publica = actividadParaElEstudiante(conClave);
    expect("clave" in publica).toBe(false);
    expect(JSON.stringify(publica)).not.toContain("respuestas");
    expect(JSON.stringify(publica)).not.toContain("\"B\"");
  });

  it("funciona igual cuando la actividad todavía no tiene clave", () => {
    const sinClave = { id: "act2", tipo: "REDACCION" as const, datos: { minimo: 60 } };
    const publica = actividadParaElEstudiante(sinClave);
    expect(publica.datos).toEqual({ minimo: 60 });
    expect("clave" in publica).toBe(false);
  });

  it("no deja pasar un campo nuevo que nadie previó", () => {
    const conExtra = { ...conClave, solucionario: "B" } as never;
    const publica = actividadParaElEstudiante(conExtra);
    expect(Object.keys(publica).sort()).toEqual(["datos", "id", "tipo"]);
  });
});
