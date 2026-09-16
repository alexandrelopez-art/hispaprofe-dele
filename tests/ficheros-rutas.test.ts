import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Persona } from "@/lib/generated/prisma";

// Ninguna prueba importaba antes las tres rutas del almacén de Vercel: se
// podían borrar las comprobaciones de papel y de sesión sin que nada se
// pusiera rojo (tests/ficheros-vercel.test.ts prueba puedeSubirMaterial, que
// es la REGLA; esto prueba las RUTAS, el sitio donde se aplica). Calcado de
// tests/grabaciones-permiso.test.ts: se dobla personaDeLaPeticion (no
// next/headers, porque las rutas usan esa envoltura directamente) y el
// módulo del almacén, para mirar exactamente qué recibe y qué deja salir
// cada ruta.
//
// El módulo del almacén se dobla con vi.importActual para las funciones
// puras (puedeSubirMaterial, tipoPermitido, rutaDelFichero,
// filaDeVercelParaGuardar, CARPETA_DE_MATERIAL): son la REGLA, ya probada en
// tests/ficheros-vercel.test.ts, y dejarlas reales es lo que hace que borrar
// el guardián de la ruta (el `if` que las llama) rompa aquí. Solo se doblan
// las que tocan la red: permisoDeSubida, enlaceDeLectura,
// comprobarQueLlegoAVercel.
const { personaDeLaPeticion, permisoDeSubida, enlaceDeLectura, comprobarQueLlegoAVercel } = vi.hoisted(
  () => ({
    personaDeLaPeticion: vi.fn(),
    permisoDeSubida: vi.fn(),
    enlaceDeLectura: vi.fn(),
    comprobarQueLlegoAVercel: vi.fn(),
  }),
);
vi.mock("@/lib/puerta/sesion-http", () => ({ personaDeLaPeticion }));
vi.mock("@/lib/ficheros/vercel", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/ficheros/vercel")>();
  return { ...real, permisoDeSubida, enlaceDeLectura, comprobarQueLlegoAVercel };
});

// Prisma se simula con una clase de error propia para el camino de la clave
// duplicada, igual que BlobNotFoundError en tests/ficheros-vercel.test.ts:
// así se comprueba exactamente qué distingue esClaveDuplicada, sin depender
// del cliente real de Prisma (que exigiría DATABASE_URL).
const { fichero, ClavePrismaDuplicada } = vi.hoisted(() => {
  class ClavePrismaDuplicada extends Error {
    code = "P2002";
  }
  return {
    fichero: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    ClavePrismaDuplicada,
  };
});
vi.mock("@/lib/db", () => ({ prisma: { fichero } }));
vi.mock("@/lib/generated/prisma", () => ({
  Prisma: { PrismaClientKnownRequestError: ClavePrismaDuplicada },
}));

import { POST as permiso } from "@/app/api/ficheros/permiso/route";
import { POST as confirmar } from "@/app/api/ficheros/confirmar/route";
import { GET as obtener } from "@/app/api/ficheros/[id]/route";

const ESTUDIANTE: Persona = {
  id: "e1",
  correo: "ana@ejemplo.com",
  nombre: "Ana",
  papel: "ESTUDIANTE",
  activa: true,
  createdAt: new Date("2026-01-01"),
};
const PROFESOR: Persona = {
  id: "p1",
  correo: "pablo@hispaprofe.com",
  nombre: "Pablo",
  papel: "PROFESOR",
  activa: true,
  createdAt: new Date("2026-01-01"),
};

function peticion(url: string, cuerpo?: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

const CUERPO_PERMISO = { nombre: "pagina1.jpg", tipoMime: "image/jpeg", bytes: 1_000_000 };
const CUERPO_CONFIRMAR = { ruta: "material/pagina1-abc.jpg", nombreOriginal: "página 1.jpg" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/ficheros/permiso", () => {
  // Mutación que mata esta prueba: quitar el `if (!persona)` del principio.
  it("sin sesión, 401 y ni se pide permiso al almacén", async () => {
    personaDeLaPeticion.mockResolvedValue(null);

    const respuesta = await permiso(peticion("http://x/api/ficheros/permiso", CUERPO_PERMISO));

    expect(respuesta.status).toBe(401);
    expect(permisoDeSubida).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar el `if (!puedeSubirMaterial(...))`.
  // Es la regla ya probada en tests/ficheros-vercel.test.ts; aquí se prueba
  // que la RUTA la aplica de verdad.
  it("un estudiante recibe 403 y ni se pide permiso al almacén", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await permiso(peticion("http://x/api/ficheros/permiso", CUERPO_PERMISO));

    expect(respuesta.status).toBe(403);
    expect(permisoDeSubida).not.toHaveBeenCalled();
  });

  // Sin esto, un tipoMime vacío (lo que manda el navegador cuando no sabe
  // decir el tipo de un fichero) caía en el 400 genérico de "datos
  // inválidos", que no explica nada. Mutación que mata esta prueba: quitar
  // el chequeo de tipoMime === "" (el mensaje pasaría a ser el de
  // tipoPermitido, "Solo se admiten imágenes o audio.").
  it("con tipoMime vacío, un mensaje propio que explica el porqué", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);

    const respuesta = await permiso(
      peticion("http://x/api/ficheros/permiso", { ...CUERPO_PERMISO, tipoMime: "" }),
    );
    const cuerpo = (await respuesta.json()) as { error: string };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error).toContain("no ha sabido decir qué tipo");
    expect(permisoDeSubida).not.toHaveBeenCalled();
  });

  it("el profesor pide permiso y recibe la url, la ruta y la caducidad", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    const validoHasta = new Date("2026-01-01T00:15:00Z");
    permisoDeSubida.mockResolvedValue({ url: "https://blob.vercel-storage.com/subida", validoHasta });

    const respuesta = await permiso(peticion("http://x/api/ficheros/permiso", CUERPO_PERMISO));
    const cuerpo = (await respuesta.json()) as { url: string; ruta: string; validoHasta: string };

    expect(respuesta.status).toBe(200);
    expect(permisoDeSubida).toHaveBeenCalledTimes(1);
    expect(cuerpo.url).toBe("https://blob.vercel-storage.com/subida");
    expect(cuerpo.ruta).toMatch(/^material\/pagina1-[0-9a-f]{12}\.jpg$/);
  });
});

describe("POST /api/ficheros/confirmar", () => {
  // Mutación que mata esta prueba: quitar el `if (!persona)` del principio.
  it("sin sesión, 401 y ni se pregunta al almacén", async () => {
    personaDeLaPeticion.mockResolvedValue(null);

    const respuesta = await confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR));

    expect(respuesta.status).toBe(401);
    expect(comprobarQueLlegoAVercel).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar el `if (!puedeSubirMaterial(...))`.
  it("un estudiante recibe 403 y ni se pregunta al almacén", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR));

    expect(respuesta.status).toBe(403);
    expect(comprobarQueLlegoAVercel).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar el chequeo de que la ruta cuelga
  // de CARPETA_DE_MATERIAL.
  it("una ruta fuera de la carpeta de material, 400 y ni se pregunta al almacén", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);

    const respuesta = await confirmar(
      peticion("http://x/api/ficheros/confirmar", { ruta: "otra-carpeta/a.jpg", nombreOriginal: "a.jpg" }),
    );

    expect(respuesta.status).toBe(400);
    expect(comprobarQueLlegoAVercel).not.toHaveBeenCalled();
  });

  it("si el almacén no confirma que el fichero llegó, 422 y no se crea fila", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    comprobarQueLlegoAVercel.mockResolvedValue(null);

    const respuesta = await confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR));

    expect(respuesta.status).toBe(422);
    expect(fichero.create).not.toHaveBeenCalled();
  });

  it("confirmado, crea la fila con el nombre original y devuelve su id", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    comprobarQueLlegoAVercel.mockResolvedValue({ bytes: 12345, tipoMime: "image/jpeg" });
    fichero.create.mockResolvedValue({ id: "f1" });

    const respuesta = await confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR));
    const cuerpo = (await respuesta.json()) as { id: string };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.id).toBe("f1");
    expect(fichero.create).toHaveBeenCalledWith({
      data: {
        almacen: "VERCEL",
        ruta: CUERPO_CONFIRMAR.ruta,
        nombreOriginal: "página 1.jpg",
        bytes: 12345,
        tipoMime: "image/jpeg",
        subidoPorId: "p1",
      },
    });
  });

  // El camino de la clave duplicada: confirmar la misma ruta dos veces (un
  // doble clic) no debe reventar, tiene que devolver la fila que ya existe.
  // Mutación que mata esta prueba: quitar el try/catch, o el chequeo de
  // esClaveDuplicada (la excepción subiría como 500 en vez de devolver el id
  // existente con 200).
  it("confirmar la misma ruta dos veces devuelve la fila que ya existía, no revienta", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    comprobarQueLlegoAVercel.mockResolvedValue({ bytes: 12345, tipoMime: "image/jpeg" });
    fichero.create.mockRejectedValue(new ClavePrismaDuplicada("clave duplicada"));
    fichero.findUniqueOrThrow.mockResolvedValue({ id: "f-existente" });

    const respuesta = await confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR));
    const cuerpo = (await respuesta.json()) as { id: string };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.id).toBe("f-existente");
    expect(fichero.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { almacen_ruta: { almacen: "VERCEL", ruta: CUERPO_CONFIRMAR.ruta } },
    });
  });

  // Un error de Prisma que NO es la clave duplicada tiene que subir tal
  // cual, no tratarse como si la fila ya existiera.
  it("un fallo de la base que no es clave duplicada sube, no se confunde con la fila que ya existe", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    comprobarQueLlegoAVercel.mockResolvedValue({ bytes: 12345, tipoMime: "image/jpeg" });
    fichero.create.mockRejectedValue(new Error("conexión perdida"));

    await expect(
      confirmar(peticion("http://x/api/ficheros/confirmar", CUERPO_CONFIRMAR)),
    ).rejects.toThrow("conexión perdida");
    expect(fichero.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("GET /api/ficheros/[id]", () => {
  function peticionDeLectura(id: string) {
    return obtener(new NextRequest(`http://x/api/ficheros/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  // Mutación que mata esta prueba: quitar el `if (!persona)` del principio.
  it("sin sesión, 401 y ni se pregunta a la base", async () => {
    personaDeLaPeticion.mockResolvedValue(null);

    const respuesta = await peticionDeLectura("f1");

    expect(respuesta.status).toBe(401);
    expect(fichero.findUnique).not.toHaveBeenCalled();
  });

  it("un id que no existe, 404", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    fichero.findUnique.mockResolvedValue(null);

    const respuesta = await peticionDeLectura("f-que-no-existe");

    expect(respuesta.status).toBe(404);
    // El mismo cuerpo que el 404 del candado (ver más abajo, "recibe el MISMO
    // 404 que si no existiera"): las dos pruebas comparan contra este cuerpo
    // exacto, así que si algún día alguien separa los dos `return` con
    // mensajes distintos, una de las dos se pone roja.
    expect(await respuesta.json()).toEqual({ error: "No encontrado." });
    expect(enlaceDeLectura).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar `fichero.almacen !== "VERCEL"` del
  // chequeo. Un fichero de Drive no se sirve por esta ruta.
  it("un fichero de Drive, 404: esta ruta no sirve ficheros de Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    fichero.findUnique.mockResolvedValue({ id: "f2", almacen: "DRIVE", ruta: "id-de-drive" });

    const respuesta = await peticionDeLectura("f2");

    expect(respuesta.status).toBe(404);
    expect(enlaceDeLectura).not.toHaveBeenCalled();
  });

  it("un fichero de Vercel, 307 al enlace de lectura, sin caché", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    fichero.findUnique.mockResolvedValue({ id: "f3", almacen: "VERCEL", ruta: "material/a-x.jpg" });
    enlaceDeLectura.mockResolvedValue("https://blob.vercel-storage.com/lectura");

    const respuesta = await peticionDeLectura("f3");

    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("https://blob.vercel-storage.com/lectura");
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
  });

  // Mutación que la mata: quitar el `puedeVerFichero(...)` del `if` de la ruta. La
  // regla suelta seguiría probada en tests/ficheros-permisos.test.ts y todo estaría
  // verde con el candado en el suelo: probar la regla y no el sitio donde se aplica
  // ya nos pilló tres veces.
  it("un estudiante que pide una página de examen recibe el MISMO 404 que si no existiera", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    fichero.findUnique.mockResolvedValue({ id: "f4", almacen: "VERCEL", ruta: "material/examen-1-01.jpg", subidoPorId: PROFESOR.id });

    const respuesta = await peticionDeLectura("f4");

    expect(respuesta.status).toBe(404);
    // Un 403 confirmaría que ese id existe: el cuerpo tiene que ser idéntico al de
    // «no existe», que es el de la prueba de arriba.
    expect(await respuesta.json()).toEqual({ error: "No encontrado." });
    expect(enlaceDeLectura).not.toHaveBeenCalled();
  });

  // Mutación que la mata: invertir la comparación de papel.
  it("el profesor sí recibe el enlace de esa misma página", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    fichero.findUnique.mockResolvedValue({ id: "f4", almacen: "VERCEL", ruta: "material/examen-1-01.jpg", subidoPorId: PROFESOR.id });
    enlaceDeLectura.mockResolvedValue("https://blob.vercel-storage.com/lectura");

    expect((await peticionDeLectura("f4")).status).toBe(307);
  });

  // Mutación que la mata: mirar el dueño solo cuando es profesor, o no mirarlo.
  it("un estudiante sí abre lo que subió él", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    fichero.findUnique.mockResolvedValue({ id: "f5", almacen: "VERCEL", ruta: "material/suyo.jpg", subidoPorId: ESTUDIANTE.id });
    enlaceDeLectura.mockResolvedValue("https://blob.vercel-storage.com/lectura");

    expect((await peticionDeLectura("f5")).status).toBe(307);
  });
});
