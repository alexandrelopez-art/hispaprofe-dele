import { describe, it, expect } from "vitest";
import configuracion from "@/next.config";

describe("las direcciones viejas llevan a las nuevas", () => {
  // Mutación que la mata: quitar cualquiera de las tres, o hacerla permanente
  // (un 308 se queda grabado en el navegador y no se puede deshacer).
  it("personas y corregir redirigen, sin quedarse grabadas", async () => {
    const reglas = await configuracion.redirects!();
    expect(reglas).toEqual(
      expect.arrayContaining([
        { source: "/personas", destination: "/estudiantes", permanent: false },
        { source: "/corregir", destination: "/pendientes", permanent: false },
        { source: "/corregir/:intentoId", destination: "/pendientes/:intentoId", permanent: false },
      ]),
    );
    expect(reglas).toHaveLength(3);
  });
});
