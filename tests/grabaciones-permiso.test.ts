import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Persona } from "@/lib/generated/prisma";

// Se simula personaDeLaPeticion (no next/headers) porque esta ruta usa esa
// envoltura directamente, igual que app/api/ficheros/permiso/route.ts. Se
// simula también abrirSesionDeSubida, para no tocar la red y para poder
// mirar EXACTAMENTE qué recibe y qué deja salir la ruta — que es donde vive
// la garantía de que la carpeta y las credenciales nunca llegan al
// estudiante.
const { personaDeLaPeticion, abrirSesionDeSubida } = vi.hoisted(() => ({
  personaDeLaPeticion: vi.fn(),
  abrirSesionDeSubida: vi.fn(),
}));
vi.mock("@/lib/puerta/sesion-http", () => ({ personaDeLaPeticion }));
vi.mock("@/lib/ficheros/drive", () => ({ abrirSesionDeSubida }));

import { POST } from "@/app/api/grabaciones/permiso/route";

const ESTUDIANTE: Persona = {
  id: "e1",
  correo: "ana@ejemplo.com",
  nombre: "Ana",
  papel: "ESTUDIANTE",
  activa: true,
  createdAt: new Date("2026-01-01"),
};

function peticion(cuerpo: unknown): NextRequest {
  return new NextRequest("http://x/api/grabaciones/permiso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // Puesta a un valor real (no undefined) para que una fuga de verdad se note
  // en el JSON: NextResponse.json (como JSON.stringify) borra las claves con
  // valor `undefined`, así que sin esto una mutación que colara
  // `process.env.DRIVE_CARPETA_GRABACIONES` en la respuesta pasaría en
  // silencio mientras la variable no esté puesta — se comprobó de verdad,
  // aplicando esa mutación, antes de fijar esto.
  process.env.DRIVE_CARPETA_GRABACIONES = "carpeta-de-prueba-que-nunca-debe-salir";
});

afterEach(() => {
  delete process.env.DRIVE_CARPETA_GRABACIONES;
});

describe("pedir sesión de subida de una grabación", () => {
  // Mutación que mata esta prueba: quitar el `if (!persona)` del principio
  // de la ruta (llamaría a abrirSesionDeSubida sin sesión ninguna).
  it("sin sesión, 401 y ni se pregunta a Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(null);

    const respuesta = await POST(peticion({ nombre: "a.webm", tipoMime: "video/webm" }));

    expect(respuesta.status).toBe(401);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar la validación de Zod (pasaría
  // `undefined` como nombre hasta abrirSesionDeSubida).
  it("sin los campos que hacen falta, 400 y ni se pregunta a Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await POST(peticion({ tipoMime: "video/webm" }));

    expect(respuesta.status).toBe(400);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: cambiar `||` por `&&` en tipoPermitido
  // (ninguno de los dos pasaría), o quitar el chequeo entero.
  it.each(["image/png", "application/pdf", "text/plain"])(
    "%s no es una grabación: 400 y ni se pregunta a Drive",
    async (tipoMime) => {
      personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

      const respuesta = await POST(peticion({ nombre: "a.bin", tipoMime }));

      expect(respuesta.status).toBe(400);
      expect(abrirSesionDeSubida).not.toHaveBeenCalled();
    },
  );

  it.each(["audio/webm", "video/webm"])("%s sí es una grabación: pide la sesión a Drive", async (tipoMime) => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    abrirSesionDeSubida.mockResolvedValue("https://www.googleapis.com/upload/.../sesion-xyz");

    const respuesta = await POST(peticion({ nombre: "a.webm", tipoMime }));

    expect(respuesta.status).toBe(200);
    expect(abrirSesionDeSubida).toHaveBeenCalledWith({ nombre: "a.webm", tipoMime });
  });

  // La prueba que importa de verdad para esta tarea: el cuerpo que ve el
  // estudiante es EXACTAMENTE { url }, y ese único campo es tal cual lo
  // devolvió abrirSesionDeSubida. Mutación que la mata: añadir cualquier
  // otro campo a la respuesta (por ejemplo `carpeta` o `datos`), o construir
  // una `url` distinta a la que dio Drive. Con toEqual (no toMatchObject) un
  // campo de más también tira la prueba, no solo uno de menos.
  it("la respuesta solo lleva la dirección de sesión, nada de la carpeta ni de credenciales", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    const sesionDeDrive = "https://www.googleapis.com/upload/drive/v3/files?upload_id=opaco-123";
    abrirSesionDeSubida.mockResolvedValue(sesionDeDrive);

    const respuesta = await POST(peticion({ nombre: "a.webm", tipoMime: "video/webm" }));
    const cuerpoDeRespuesta = (await respuesta.json()) as unknown;

    expect(cuerpoDeRespuesta).toEqual({ url: sesionDeDrive });
  });
});
