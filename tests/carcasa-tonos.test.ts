import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { tonoDelEstado, tonoDelExamen, varianteDelBoton } from "@/lib/carcasa/tonos";

const con = (estado: "SIN_EMPEZAR" | "HACIENDO" | "ESPERANDO" | "ENTREGADA") => ({
  prueba: "CE" as const,
  estado: { estado, aciertos: null, total: null, porTiempo: false },
  texto: "",
});

describe("el color del estado de cada prueba", () => {
  // Mutación que la mata: un tono fijo, o «entregada» en el tono de error.
  it("sin empezar, a medias y entregada se distinguen", () => {
    expect(tonoDelEstado(con("SIN_EMPEZAR"))).toBe("neutro");
    expect(tonoDelEstado(con("HACIENDO"))).toBe("info");
    expect(tonoDelEstado(con("ENTREGADA"))).toBe("exito");
    expect(tonoDelEstado(undefined)).toBe("neutro");
  });

  // Mutación que la mata: tratar ESPERANDO (escrita entregada, esperando
  // corrección) como si no estuviera entregada.
  it("esperando corrección se pinta como entregada", () => {
    expect(tonoDelEstado(con("ESPERANDO"))).toBe("exito");
    expect(varianteDelBoton(con("ESPERANDO"))).toBe("secundario");
  });

  // Mutación que la mata: el mismo botón para repasar que para empezar.
  it("repasar es secundario; empezar, seguir y practicar son principales", () => {
    expect(varianteDelBoton(con("ENTREGADA"))).toBe("secundario");
    expect(varianteDelBoton(con("SIN_EMPEZAR"))).toBe("principal");
    expect(varianteDelBoton(con("HACIENDO"))).toBe("principal");
    expect(varianteDelBoton(undefined)).toBe("principal");
  });
});

describe("el color de la etiqueta de un examen", () => {
  // Mutación que la mata: PUBLICADO en "info" en vez de "exito".
  it("en construcción y archivado son neutros; publicado, éxito", () => {
    expect(tonoDelExamen("EN_CONSTRUCCION")).toBe("neutro");
    expect(tonoDelExamen("PUBLICADO")).toBe("exito");
    expect(tonoDelExamen("ARCHIVADO")).toBe("neutro");
  });
});
