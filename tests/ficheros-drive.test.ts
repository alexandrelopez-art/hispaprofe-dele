import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// abrirSesionDeSubida habla con Google (JWT de google-auth-library y fetch): se
// simulan los dos para no tocar la red y para poder mirar EXACTAMENTE qué le
// mandamos, igual que en tests/ficheros-vercel.test.ts. vi.hoisted porque
// vi.mock se eleva por encima de cualquier variable normal.
const { getAccessToken, JWTMock, fetchMock } = vi.hoisted(() => {
  const getAccessToken = vi.fn();
  class JWTMock {
    email: string;
    key: string;
    scopes: string[];
    constructor(opciones: { email: string; key: string; scopes: string[] }) {
      this.email = opciones.email;
      this.key = opciones.key;
      this.scopes = opciones.scopes;
    }
    getAccessToken = getAccessToken;
  }
  return { getAccessToken, JWTMock, fetchMock: vi.fn() };
});
vi.mock("google-auth-library", () => ({ JWT: JWTMock }));

import {
  peticionDeSesion,
  abrirSesionDeSubida,
  comprobarQueLlegoADrive,
  filaDeDriveParaGuardar,
} from "@/lib/ficheros/drive";

const CREDENCIALES = JSON.stringify({
  client_email: "robot@hyl.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n",
});
const CARPETA = "CARPETA-SECRETA-DE-GRABACIONES";

function respuestaDeGoogle(datos: { ok: boolean; status?: number; location?: string | null }) {
  return {
    ok: datos.ok,
    status: datos.status ?? (datos.ok ? 200 : 500),
    // Headers.get() de verdad no distingue mayúsculas de minúsculas en el
    // nombre de la cabecera; el doble tampoco, para que una variación
    // inocua en el código de producción (.get("Location") en vez de
    // .get("location")) no ponga roja una prueba que está bien.
    headers: { get: (nombre: string) => (nombre.toLowerCase() === "location" ? (datos.location ?? null) : null) },
  };
}

function respuestaDeDrive(datos: { status?: number; cuerpo?: unknown }) {
  const status = datos.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => datos.cuerpo,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.GOOGLE_CUENTA_DE_SERVICIO = CREDENCIALES;
  process.env.DRIVE_CARPETA_GRABACIONES = CARPETA;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CUENTA_DE_SERVICIO;
  delete process.env.DRIVE_CARPETA_GRABACIONES;
});

describe("la petición de subida a Drive", () => {
  it("pide una sesión reanudable y avisa de que la carpeta es una unidad compartida", () => {
    const { url } = peticionDeSesion({ nombre: "a.webm", tipoMime: "video/webm", carpeta: "C1" });
    expect(url).toContain("uploadType=resumable");
    expect(url).toContain("supportsAllDrives=true");
  });

  it("cuelga el fichero de la carpeta que se le dice", () => {
    const { cuerpo } = peticionDeSesion({ nombre: "a.webm", tipoMime: "video/webm", carpeta: "C1" });
    expect(JSON.parse(cuerpo)).toEqual({ name: "a.webm", parents: ["C1"], mimeType: "video/webm" });
  });
});

describe("abrir la sesión de subida", () => {
  it("sin GOOGLE_CUENTA_DE_SERVICIO, avisa y no llega a llamar a Google", async () => {
    delete process.env.GOOGLE_CUENTA_DE_SERVICIO;

    await expect(abrirSesionDeSubida({ nombre: "a.webm", tipoMime: "video/webm" })).rejects.toThrow(
      "GOOGLE_CUENTA_DE_SERVICIO",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin DRIVE_CARPETA_GRABACIONES, avisa y no llega a llamar a Google", async () => {
    delete process.env.DRIVE_CARPETA_GRABACIONES;

    await expect(abrirSesionDeSubida({ nombre: "a.webm", tipoMime: "video/webm" })).rejects.toThrow(
      "DRIVE_CARPETA_GRABACIONES",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Esta es la prueba que de verdad ejercita la función: mira la petición que
  // sale de verdad hacia Google, no solo lo que devuelve. Mutación que la mata
  // (entre otras): quitar `supportsAllDrives=true` de la URL (Step 4 del
  // encargo), mandar la carpeta o el token en el sitio equivocado, o usar el
  // método/cabecera que no toca.
  it("pide el token a la cuenta robot, abre la sesión con la carpeta de las grabaciones y devuelve la dirección de Location", async () => {
    getAccessToken.mockResolvedValue({ token: "token-de-prueba" });
    fetchMock.mockResolvedValue(
      respuestaDeGoogle({ ok: true, location: "https://www.googleapis.com/upload/.../sesion-xyz" }),
    );

    const sesion = await abrirSesionDeSubida({ nombre: "grabacion.webm", tipoMime: "video/webm" });

    expect(sesion).toBe("https://www.googleapis.com/upload/.../sesion-xyz");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toContain("supportsAllDrives=true");
    expect(opciones).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer token-de-prueba", "Content-Type": "application/json" },
    });
    expect(JSON.parse(opciones.body)).toEqual({
      name: "grabacion.webm",
      parents: [CARPETA],
      mimeType: "video/webm",
    });
  });

  it("usa la cuenta robot del JSON (correo y clave), con el alcance drive.file y nada más amplio", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(respuestaDeGoogle({ ok: true, location: "https://sesion" }));

    await abrirSesionDeSubida({ nombre: "a.webm", tipoMime: "audio/webm" });

    const credenciales = JSON.parse(CREDENCIALES);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    // El propio constructor del doble guarda lo que se le pasó, así que se
    // comprueba a través de la instancia real que creó abrirSesionDeSubida.
    const instancia = getAccessToken.mock.instances[0] as InstanceType<typeof JWTMock>;
    expect(instancia.email).toBe(credenciales.client_email);
    expect(instancia.key).toBe(credenciales.private_key);
    expect(instancia.scopes).toEqual(["https://www.googleapis.com/auth/drive.file"]);
  });

  // La cabecera Location lleva un valor DE MENTIRA (no null): si la prueba
  // montara la respuesta sin Location, la condición `!respuesta.ok ||
  // !sesion` fallaría igual sin necesitar el `!respuesta.ok` — la mitad que
  // mira el estado no la ejercitaría nadie. Comprobado de verdad: quitando
  // `!respuesta.ok ||` de la condición con la respuesta de abajo (status
  // 404 + Location de mentira), las demás pruebas del bloque seguían verdes
  // y solo esta se ponía roja, tal como debe ser.
  it("si Google no confirma (respuesta que no es ok), el error dice el estado que devolvió, aunque la respuesta traiga cabecera Location", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(
      respuestaDeGoogle({ ok: false, status: 404, location: "https://sesion-de-mentira" }),
    );

    await expect(abrirSesionDeSubida({ nombre: "a.webm", tipoMime: "video/webm" })).rejects.toThrow("404");
  });

  // Sin esto, un `respuesta.ok` a secas (sin mirar la cabecera Location) dejaría
  // pasar una respuesta 200 rara sin sesión ninguna, y quien llama recibiría
  // `undefined` como si fuera una dirección válida.
  it("si Google responde ok pero sin cabecera Location, también falla", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(respuestaDeGoogle({ ok: true, location: null }));

    await expect(abrirSesionDeSubida({ nombre: "a.webm", tipoMime: "video/webm" })).rejects.toThrow(
      /Google no abrió la sesión/,
    );
  });
});

describe("confirmar una grabación contra Drive", () => {
  it("si el fichero existe y cuelga de la carpeta de las grabaciones, devuelve sus bytes y su tipo", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(
      respuestaDeDrive({ cuerpo: { mimeType: "video/webm", size: "4812345", parents: [CARPETA] } }),
    );

    const confirmado = await comprobarQueLlegoADrive("id-del-fichero");

    expect(confirmado).toEqual({ bytes: 4812345, tipoMime: "video/webm" });
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toContain("supportsAllDrives=true");
    expect(url).toContain("id-del-fichero");
    expect(opciones).toMatchObject({ headers: { Authorization: "Bearer t" } });
  });

  it("si Drive dice que no existe (404), no confirma", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(respuestaDeDrive({ status: 404, cuerpo: {} }));

    await expect(comprobarQueLlegoADrive("id-que-no-existe")).resolves.toBeNull();
  });

  // Esta es LA prueba que importa: un fichero que existe de verdad, pero en
  // otra carpeta a la que la cuenta robot también tenga acceso, tampoco
  // confirma. Sin este chequeo, conocer el identificador de CUALQUIER
  // fichero (por ejemplo, la grabación de otro estudiante, o algo ajeno a
  // las grabaciones) bastaría para reclamarlo como propio en guardarGrabacion.
  it("si el fichero existe pero no cuelga de la carpeta de las grabaciones, tampoco confirma", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(
      respuestaDeDrive({ cuerpo: { mimeType: "video/webm", size: "1", parents: ["OTRA-CARPETA-CUALQUIERA"] } }),
    );

    await expect(comprobarQueLlegoADrive("id-de-otra-carpeta")).resolves.toBeNull();
  });

  it("si Drive falla por otra razón (no 404), el error sube y no se trata como 'no existe'", async () => {
    getAccessToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue(respuestaDeDrive({ status: 500, cuerpo: {} }));

    await expect(comprobarQueLlegoADrive("id-cualquiera")).rejects.toThrow("500");
  });
});

describe("qué fila escribir tras confirmar una grabación", () => {
  it("sin confirmación de Drive no se guarda ninguna fila", () => {
    expect(
      filaDeDriveParaGuardar({ ruta: "id-1", nombreOriginal: "mi vídeo.webm", subidoPorId: "e1" }, null),
    ).toBeNull();
  });

  // filaDeDriveParaGuardar ni siquiera recibe bytes o tipo de quien llama: lo único
  // que puede escribir en la fila es lo que confirma Drive. Mutación que
  // mata esta prueba: usar algún campo de `datos` para bytes/tipoMime en vez
  // de `confirmado`, o mezclar los dos campos entre sí.
  it("la fila toma el tamaño y el tipo de lo que confirma Drive, y el nombre original de quien sube", () => {
    const fila = filaDeDriveParaGuardar(
      { ruta: "id-1", nombreOriginal: "mi vídeo.webm", subidoPorId: "e1" },
      { bytes: 4812345, tipoMime: "video/webm" },
    );
    expect(fila).toEqual({
      almacen: "DRIVE",
      ruta: "id-1",
      nombreOriginal: "mi vídeo.webm",
      bytes: 4812345,
      tipoMime: "video/webm",
      subidoPorId: "e1",
    });
  });
});
