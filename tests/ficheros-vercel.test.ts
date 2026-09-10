import { describe, it, expect } from "vitest";
import {
  rutaDelFichero,
  puedeSubirMaterial,
  filaParaGuardar,
  MINUTOS_DE_SUBIDA,
  MINUTOS_DE_LECTURA,
} from "@/lib/ficheros/vercel";

describe("las rutas del almacén", () => {
  it("cuelga el fichero de su carpeta y le pega un sufijo, para que dos iguales no choquen", () => {
    expect(rutaDelFichero("examenes/1", "pagina 1.JPG", "xyz")).toBe("examenes/1/pagina-1-xyz.jpg");
  });

  it("no deja escapar de su carpeta con puntos ni barras", () => {
    expect(rutaDelFichero("examenes/1", "../../secreto.jpg", "xyz")).toBe("examenes/1/secreto-xyz.jpg");
  });

  // La prueba de arriba no mata la mutación que quita `.split(/[\\/]/).pop()`:
  // "../../secreto" es solo un prefijo de puntos y barras, y el
  // `.replace(/[^a-z0-9]+/g, "-")` de más abajo también lo limpia por su
  // cuenta, así que las dos versiones dan "secreto" igual. Hace falta una
  // barra que NO sea un prefijo de escape para que las dos formas
  // diverjan: con `.pop()` se queda solo con el último tramo; sin él, junta
  // todos los tramos con guiones.
  it("si el nombre trae un tramo de carpeta de verdad, se queda solo con el último", () => {
    expect(rutaDelFichero("examenes/1", "sub/dir/foto.png", "xyz")).toBe("examenes/1/foto-xyz.png");
  });

  it("el permiso de lectura dura mucho menos que el de subida", () => {
    expect(MINUTOS_DE_LECTURA).toBeLessThan(MINUTOS_DE_SUBIDA);
    expect(MINUTOS_DE_LECTURA).toBeLessThanOrEqual(5);
  });
});

describe("quién puede subir material del examen", () => {
  it("el profesor sí, el estudiante no", () => {
    expect(puedeSubirMaterial("PROFESOR")).toBe(true);
    expect(puedeSubirMaterial("ESTUDIANTE")).toBe(false);
  });
});

describe("lo que se guarda después de subir", () => {
  it("sin confirmación del almacén no se guarda ninguna fila", () => {
    expect(filaParaGuardar({ ruta: "examenes/1/a-x.jpg", subidoPorId: "p1" }, null)).toBeNull();
  });

  it("se fía del almacén, no de lo que diga el navegador", () => {
    const fila = filaParaGuardar(
      { ruta: "examenes/1/a-x.jpg", subidoPorId: "p1", bytesSegunElNavegador: 10 },
      { bytes: 4_812_345, tipoMime: "image/jpeg" },
    );
    expect(fila).toEqual({
      almacen: "VERCEL",
      ruta: "examenes/1/a-x.jpg",
      bytes: 4_812_345,
      tipoMime: "image/jpeg",
      subidoPorId: "p1",
    });
  });
});
