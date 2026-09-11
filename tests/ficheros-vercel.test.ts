import { describe, it, expect, vi, beforeEach } from "vitest";

// permisoDeSubida y enlaceDeLectura hablan con @vercel/blob. Se simula el
// paquete entero para no tocar la red y para poder mirar EXACTAMENTE qué le
// mandamos: eso es lo que hace que una prueba que solo compara dos
// constantes entre sí (MINUTOS_DE_LECTURA < MINUTOS_DE_SUBIDA) no sea toda
// la historia — nadie llamaba a las funciones de verdad, así que cambiar la
// caducidad de lectura a una hora se colaba en verde.
const { issueSignedToken, presignUrl, head, BlobNotFoundError } = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  return { issueSignedToken: vi.fn(), presignUrl: vi.fn(), head: vi.fn(), BlobNotFoundError };
});
vi.mock("@vercel/blob", () => ({ issueSignedToken, presignUrl, head, BlobNotFoundError }));

import {
  rutaDelFichero,
  tipoPermitido,
  puedeSubirMaterial,
  filaDeVercelParaGuardar,
  comprobarQueLlegoAVercel,
  permisoDeSubida,
  enlaceDeLectura,
  MINUTOS_DE_SUBIDA,
  MINUTOS_DE_LECTURA,
} from "@/lib/ficheros/vercel";

const MINUTO = 60_000;

beforeEach(() => {
  vi.resetAllMocks();
});

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

  // La extensión también viene del navegador. Sin sanear, una barra colada
  // ahí mete un tramo de carpeta que no estaba en la base, y descuadra la
  // ruta firmada frente a la que se guarda luego.
  it("también sanea la extensión: nada de barras ni signos raros después del último punto", () => {
    expect(rutaDelFichero("examenes/1", "audio.mp3/x", "xyz")).toBe("examenes/1/audio-xyz.mp3x");
  });

  it("si no queda nada de la extensión tras limpiarla, usa bin", () => {
    expect(rutaDelFichero("examenes/1", "foto.???", "xyz")).toBe("examenes/1/foto-xyz.bin");
  });

  it("el permiso de lectura dura mucho menos que el de subida", () => {
    expect(MINUTOS_DE_LECTURA).toBeLessThan(MINUTOS_DE_SUBIDA);
    expect(MINUTOS_DE_LECTURA).toBeLessThanOrEqual(5);
  });
});

describe("qué tipos admite el almacén", () => {
  it("imágenes y audio sí, vídeo no", () => {
    expect(tipoPermitido("image/jpeg")).toBe(true);
    expect(tipoPermitido("audio/mpeg")).toBe(true);
    expect(tipoPermitido("video/mp4")).toBe(false);
  });

  // SVG es un formato de imagen que puede llevar un guion (código) dentro:
  // aquí solo entran páginas escaneadas y audios de examen.
  it("SVG no, aunque empiece por image/", () => {
    expect(tipoPermitido("image/svg+xml")).toBe(false);
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
    expect(
      filaDeVercelParaGuardar(
        { ruta: "examenes/1/a-x.jpg", nombreOriginal: "página 1.jpg", subidoPorId: "p1" },
        null,
      ),
    ).toBeNull();
  });

  // filaDeVercelParaGuardar ni siquiera recibe bytes o tipo de quien llama: lo único
  // que puede escribir en la fila (salvo nombreOriginal) es lo que confirma el
  // almacén. Mutación que mata esta prueba: usar algún campo de `datos` para
  // bytes/tipoMime en vez de `confirmado`, o mezclar los dos campos entre sí, o
  // perder nombreOriginal por el camino.
  it("la fila toma el tamaño y el tipo de lo que confirma el almacén, y el nombre original de quien sube", () => {
    const fila = filaDeVercelParaGuardar(
      { ruta: "examenes/1/a-x.jpg", nombreOriginal: "página 1.jpg", subidoPorId: "p1" },
      { bytes: 4_812_345, tipoMime: "image/jpeg" },
    );
    expect(fila).toEqual({
      almacen: "VERCEL",
      ruta: "examenes/1/a-x.jpg",
      nombreOriginal: "página 1.jpg",
      bytes: 4_812_345,
      tipoMime: "image/jpeg",
      subidoPorId: "p1",
    });
  });
});

describe("comprobarQueLlegoAVercel", () => {
  it("si el almacén dice que no está, no hay fichero: null", async () => {
    head.mockRejectedValue(new BlobNotFoundError());
    await expect(comprobarQueLlegoAVercel("examenes/1/a-x.jpg")).resolves.toBeNull();
  });

  // Mutación que mata esta prueba: hacer que cualquier error (no solo
  // BlobNotFoundError) devuelva null. Un corte de red o una llave que falta
  // no es "el fichero no llegó": es que no se pudo ni preguntar, y eso tiene
  // que reventar la petición, no decir en silencio que la subida falló.
  it("cualquier otro fallo del almacén no se traga: sube", async () => {
    head.mockRejectedValue(new Error("ECONNRESET"));
    await expect(comprobarQueLlegoAVercel("examenes/1/a-x.jpg")).rejects.toThrow("ECONNRESET");
  });
});

describe("permisoDeSubida pide el token que dice que pide", () => {
  beforeEach(() => {
    issueSignedToken.mockResolvedValue({
      delegationToken: "delegacion",
      clientSigningToken: "firma",
      validUntil: 0,
    });
    presignUrl.mockResolvedValue({ presignedUrl: "https://blob.vercel-storage.com/subida" });
  });

  // Mutación que mata esta prueba: cambiar MINUTOS_DE_SUBIDA por
  // MINUTOS_DE_LECTURA (o cualquier otro número) en permisoDeSubida. El
  // validUntil que se le pide al almacén tiene que ser EXACTAMENTE la hora
  // dada más los quince minutos de subida, ni un minuto más ni menos.
  it("pide escritura con la caducidad de los quince minutos y los límites dados", async () => {
    const ahora = new Date("2026-01-01T00:00:00.000Z");
    const resultado = await permisoDeSubida("examenes/1/a-x.jpg", ["image/jpeg"], 5_000_000, ahora);

    expect(issueSignedToken).toHaveBeenCalledWith({
      pathname: "examenes/1/a-x.jpg",
      operations: ["put"],
      validUntil: ahora.getTime() + MINUTOS_DE_SUBIDA * MINUTO,
      allowedContentTypes: ["image/jpeg"],
      maximumSizeInBytes: 5_000_000,
    });
    expect(presignUrl).toHaveBeenCalledWith(
      { delegationToken: "delegacion", clientSigningToken: "firma", validUntil: 0 },
      { operation: "put", pathname: "examenes/1/a-x.jpg", access: "private" },
    );
    expect(resultado).toEqual({
      url: "https://blob.vercel-storage.com/subida",
      validoHasta: new Date(ahora.getTime() + MINUTOS_DE_SUBIDA * MINUTO),
    });
  });
});

describe("enlaceDeLectura pide el token que dice que pide", () => {
  beforeEach(() => {
    issueSignedToken.mockResolvedValue({
      delegationToken: "delegacion",
      clientSigningToken: "firma",
      validUntil: 0,
    });
    presignUrl.mockResolvedValue({ presignedUrl: "https://blob.vercel-storage.com/lectura" });
  });

  // Mutación que mata esta prueba: cambiar MINUTOS_DE_LECTURA por
  // MINUTOS_DE_SUBIDA en enlaceDeLectura. Sin esto, un enlace "de lectura"
  // podría durar los quince minutos de la subida en vez de los cinco de
  // lectura, y eso rompe "ningún enlace de lectura dura más de cinco
  // minutos" sin que ninguna prueba se dé cuenta.
  it("pide SOLO lectura, con la caducidad de los cinco minutos", async () => {
    const ahora = new Date("2026-01-01T00:00:00.000Z");
    const url = await enlaceDeLectura("examenes/1/a-x.jpg", ahora);

    expect(issueSignedToken).toHaveBeenCalledWith({
      pathname: "examenes/1/a-x.jpg",
      operations: ["get"],
      validUntil: ahora.getTime() + MINUTOS_DE_LECTURA * MINUTO,
    });
    expect(presignUrl).toHaveBeenCalledWith(
      { delegationToken: "delegacion", clientSigningToken: "firma", validUntil: 0 },
      { operation: "get", pathname: "examenes/1/a-x.jpg", access: "private" },
    );
    expect(url).toBe("https://blob.vercel-storage.com/lectura");
  });
});
