import { describe, it, expect } from "vitest";
import { listaDeNombres } from "@/lib/examen/asignar";

describe("la lista de nombres del aviso", () => {
  // Mutación que la mata: pegar todos los nombres. Con doce estudiantes el
  // mensaje de error no cabría en la pantalla.
  it("dice tres y cuenta el resto", () => {
    expect(listaDeNombres(["Ana"])).toBe("Ana");
    expect(listaDeNombres(["Ana", "Luis"])).toBe("Ana y Luis");
    expect(listaDeNombres(["Ana", "Luis", "Marta"])).toBe("Ana, Luis y Marta");
    expect(listaDeNombres(["Ana", "Luis", "Marta", "Eva"])).toBe("Ana, Luis, Marta y 1 más");
    expect(listaDeNombres(["Ana", "Luis", "Marta", "Eva", "Juan"])).toBe("Ana, Luis, Marta y 2 más");
  });
});
