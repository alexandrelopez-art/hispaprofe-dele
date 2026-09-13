import { describe, it, expect } from "vitest";
import { examenesDelCuadernillo } from "@/lib/taller/cuadernillo-elegido";

const CUADERNILLOS = [
  { id: "c1", titulo: "Libro 1", examenes: ["1", "2"] },
  { id: "c2", titulo: "Libro 2", examenes: ["3"] },
];

// Con un cuadernillo corrupto de id "" en la lista, «nada elegido todavía»
// (id "") no puede confundirse con él: si no fuera por el `if (!id)`, un
// `.find` que lo encontrase colaría sus números como si el profesor los
// hubiera elegido.
const CON_ID_VACIO = [...CUADERNILLOS, { id: "", titulo: "Corrupto", examenes: ["9"] }];

describe("examenesDelCuadernillo", () => {
  // Mutación que la mata: devolver siempre [] (ignorar el `.find` y su `.examenes`).
  it("da los números del cuadernillo elegido", () => {
    expect(examenesDelCuadernillo(CUADERNILLOS, "c1")).toEqual(["1", "2"]);
    expect(examenesDelCuadernillo(CUADERNILLOS, "c2")).toEqual(["3"]);
  });

  // Mutación que la mata: devolver el primer cuadernillo de la lista cuando
  // el id no aparece, en vez de [] (por ejemplo, `cuadernillos[0]?.examenes
  // ?? []` en lugar de buscar por id).
  it("un id que no existe no da números", () => {
    expect(examenesDelCuadernillo(CUADERNILLOS, "nada")).toEqual([]);
  });

  // Mutación que la mata: quitar el `if (!id) return [];` (con un
  // cuadernillo de id "" en la lista, "" pasaría a encontrarlo y a devolver
  // sus números).
  it("sin nada elegido todavía (id vacío) no da números, ni con un cuadernillo de id vacío en la lista", () => {
    expect(examenesDelCuadernillo(CON_ID_VACIO, "")).toEqual([]);
  });
});
