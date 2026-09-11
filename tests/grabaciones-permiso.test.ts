import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Persona } from "@/lib/generated/prisma";

// Se simula personaDeLaPeticion (no next/headers) porque esta ruta usa esa
// envoltura directamente, igual que app/api/ficheros/permiso/route.ts. Se
// simula también abrirSesionDeSubida, para no tocar la red y para poder
// mirar EXACTAMENTE qué recibe y qué deja salir la ruta — que es donde vive
// la garantía de que la carpeta y las credenciales nunca llegan a quien sube.
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
const PROFESOR: Persona = {
  id: "p1",
  correo: "pablo@hispaprofe.com",
  nombre: "Pablo",
  papel: "PROFESOR",
  activa: true,
  createdAt: new Date("2026-01-01"),
};

const CUERPO_VALIDO = { nombre: "a.webm", tipoMime: "video/webm", bytes: 1_000_000 };

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

    const respuesta = await POST(peticion(CUERPO_VALIDO));

    expect(respuesta.status).toBe(401);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: quitar la validación de Zod (pasaría
  // `undefined` como nombre hasta abrirSesionDeSubida).
  it("sin los campos que hacen falta, 400 y ni se pregunta a Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await POST(peticion({ tipoMime: "video/webm", bytes: 1000 }));

    expect(respuesta.status).toBe(400);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  it("sin bytes, 400 y ni se pregunta a Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await POST(peticion({ nombre: "a.webm", tipoMime: "video/webm" }));

    expect(respuesta.status).toBe(400);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  // Mutación que mata esta prueba: cambiar `||` por `&&` en tipoPermitido
  // (ninguno de los dos pasaría), o quitar el chequeo entero.
  it.each(["image/png", "application/pdf", "text/plain"])(
    "%s no es una grabación: 400 y ni se pregunta a Drive",
    async (tipoMime) => {
      personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

      const respuesta = await POST(peticion({ nombre: "a.bin", tipoMime, bytes: 1000 }));

      expect(respuesta.status).toBe(400);
      expect(abrirSesionDeSubida).not.toHaveBeenCalled();
    },
  );

  // Mutación que mata esta prueba: subir (o quitar) el tope de 500 MB, o
  // comparar con el operador que no toca (>= en vez de >, por ejemplo, dejaría
  // pasar exactamente 500 MB en vez de cortarlo un byte más arriba — no se
  // distingue aquí, pero si hiciera falta un byte exacto de precisión se
  // añadiría un caso al límite).
  it("una grabación de más de 500 MB, 400 y ni se pregunta a Drive", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);

    const respuesta = await POST(
      peticion({ nombre: "a.webm", tipoMime: "video/webm", bytes: 500 * 1024 * 1024 + 1 }),
    );

    expect(respuesta.status).toBe(400);
    expect(abrirSesionDeSubida).not.toHaveBeenCalled();
  });

  it.each(["audio/webm", "video/webm"])("%s sí es una grabación: pide la sesión a Drive", async (tipoMime) => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    abrirSesionDeSubida.mockResolvedValue("https://www.googleapis.com/upload/.../sesion-xyz");

    const respuesta = await POST(peticion({ ...CUERPO_VALIDO, tipoMime }));

    expect(respuesta.status).toBe(200);
    expect(abrirSesionDeSubida).toHaveBeenCalledTimes(1);
  });

  // El profesor también graba ejemplos: esta ruta no está cerrada a solo
  // estudiantes. Mutación que mata esta prueba: añadir un chequeo de papel
  // que solo deje pasar ESTUDIANTE.
  it("el profesor también puede pedir sesión de subida", async () => {
    personaDeLaPeticion.mockResolvedValue(PROFESOR);
    abrirSesionDeSubida.mockResolvedValue("https://www.googleapis.com/upload/.../sesion-xyz");

    const respuesta = await POST(peticion(CUERPO_VALIDO));

    expect(respuesta.status).toBe(200);
  });

  // El nombre que llega hasta Drive no es el que mandó el navegador tal
  // cual: se limpia y se le pega un sufijo aleatorio (nombreSaneado), igual
  // que en el almacén de Vercel. Mutación que mata esta prueba: pasar
  // `nombre` sin sanear a abrirSesionDeSubida.
  it("el nombre que llega a Drive está saneado, no es el que mandó el navegador tal cual", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    abrirSesionDeSubida.mockResolvedValue("https://sesion");

    await POST(peticion({ nombre: "../Grabación de Ana (1).WEBM", tipoMime: "video/webm", bytes: 1000 }));

    expect(abrirSesionDeSubida).toHaveBeenCalledWith({
      nombre: expect.stringMatching(/^grabacion-de-ana-1-[0-9a-f]{12}\.webm$/),
      tipoMime: "video/webm",
    });
  });

  // La prueba que importa de verdad para esta tarea: el cuerpo que ve quien
  // sube es EXACTAMENTE { url }, y ese único campo es tal cual lo devolvió
  // abrirSesionDeSubida. Mutación que la mata: añadir cualquier otro campo a
  // la respuesta (por ejemplo `carpeta` o `datos`), o construir una `url`
  // distinta a la que dio Drive. Con toEqual (no toMatchObject) un campo de
  // más también tira la prueba, no solo uno de menos.
  it("la respuesta solo lleva la dirección de sesión, nada de la carpeta ni de credenciales", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    const sesionDeDrive = "https://www.googleapis.com/upload/drive/v3/files?upload_id=opaco-123";
    abrirSesionDeSubida.mockResolvedValue(sesionDeDrive);

    const respuesta = await POST(peticion(CUERPO_VALIDO));
    const cuerpoDeRespuesta = (await respuesta.json()) as unknown;

    expect(cuerpoDeRespuesta).toEqual({ url: sesionDeDrive });
  });

  // Mutación que mata esta prueba: quitar el try/catch alrededor de
  // abrirSesionDeSubida (la excepción subiría y Next respondería un 500 sin
  // cuerpo, en vez de un JSON en español con el motivo).
  it("si Drive no abre la sesión, 502 con un mensaje fijo, no un 500 en blanco", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    abrirSesionDeSubida.mockRejectedValue(new Error("Google no abrió la sesión de subida (404)."));

    const respuesta = await POST(peticion(CUERPO_VALIDO));
    const cuerpoDeRespuesta = (await respuesta.json()) as { error: string };

    expect(respuesta.status).toBe(502);
    expect(cuerpoDeRespuesta.error).toBe("No se pudo abrir la sesión de subida. Avisa al profesor.");
  });

  // El mensaje de la excepción NUNCA llega al navegador, sea cual sea: si
  // GOOGLE_CUENTA_DE_SERVICIO viene con un JSON mal pegado, el mensaje del
  // error de JSON.parse puede llevar un trozo del texto de entrada (la
  // credencial). Mutación que mata esta prueba: devolver
  // `error.message` (o cualquier parte de él) en el cuerpo en vez del
  // mensaje fijo.
  it("el mensaje de la excepción no se filtra a la respuesta, ni un trozo", async () => {
    personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
    abrirSesionDeSubida.mockRejectedValue(
      new Error('Unexpected token in JSON: "private_key":"MIIEvQIBADANBgk..." at position 47'),
    );

    const respuesta = await POST(peticion(CUERPO_VALIDO));
    const cuerpoDeRespuesta = (await respuesta.json()) as { error: string };

    expect(cuerpoDeRespuesta.error).not.toContain("private_key");
    expect(cuerpoDeRespuesta.error).not.toContain("JSON");
    expect(cuerpoDeRespuesta.error).toBe("No se pudo abrir la sesión de subida. Avisa al profesor.");
  });
});
