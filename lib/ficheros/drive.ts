import { JWT } from "google-auth-library";

// ÚNICO sitio donde se decide POR DÓNDE viajan los bytes de una grabación.
// Hoy `abrirSesionDeSubida` abre una sesión reanudable de Drive y el
// navegador del estudiante sube directo ahí con un PUT (ver
// app/pruebas/grabar/formulario.tsx: pide una URL y le hace PUT, sin saber
// de dónde es esa URL). El supuesto sin comprobar (Step 0 del encargo, no se
// puede hacer todavía porque faltan la cuenta robot y la unidad compartida)
// es que Google admita esa subida entre orígenes.
//
// Si no lo admitiera, el plan de reserva es subir en trozos a través de
// nuestro servidor. Eso SÍ cambiaría solo esta función y no la ruta
// (app/api/grabaciones/permiso/route.ts): dejaría de devolver la dirección
// de Google y devolvería la de un endpoint propio que recibiera cada trozo
// (por debajo de los 4,5 MB) y lo reenviara a Drive con la cuenta de
// servicio; la ruta seguiría limitándose a devolver la URL que le dé esta
// función. Pero la PANTALLA (formulario.tsx) sí tendría que cambiar, y no
// poco: hoy hace un único `fetch(url, { method: "PUT", body: fichero })`
// con el fichero entero; subir en trozos exige que el propio navegador lo
// trocee (leer el `File` en pedazos, mandar cada uno con su cabecera
// Content-Range, reintentar el que falle) y eso hoy no existe. Que quien
// planifique el taller no cuente con que ese troceo ya está escrito: es
// código nuevo, no un cambio de una URL.
const RAIZ = "https://www.googleapis.com/upload/drive/v3/files";
const RAIZ_METADATOS = "https://www.googleapis.com/drive/v3/files";

export function peticionDeSesion(datos: {
  nombre: string;
  tipoMime: string;
  carpeta: string;
}): { url: string; cuerpo: string } {
  return {
    url: `${RAIZ}?uploadType=resumable&supportsAllDrives=true`,
    cuerpo: JSON.stringify({
      name: datos.nombre,
      parents: [datos.carpeta],
      mimeType: datos.tipoMime,
    }),
  };
}

function cuentaDeServicio(): JWT {
  const json = process.env.GOOGLE_CUENTA_DE_SERVICIO;
  if (!json) {
    throw new Error(
      "Falta GOOGLE_CUENTA_DE_SERVICIO. Es el JSON de la cuenta robot que escribe " +
        "en la unidad compartida de las grabaciones.",
    );
  }
  const credenciales = JSON.parse(json);
  return new JWT({
    email: credenciales.client_email,
    key: credenciales.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

/**
 * Abre la sesión de subida y devuelve su dirección. El navegador del estudiante sube
 * directo ahí; el fichero no pasa nunca por nuestro servidor.
 */
export async function abrirSesionDeSubida(datos: {
  nombre: string;
  tipoMime: string;
  origen: string;
}): Promise<string> {
  const carpeta = process.env.DRIVE_CARPETA_GRABACIONES;
  if (!carpeta) throw new Error("Falta DRIVE_CARPETA_GRABACIONES, el id de la unidad compartida.");

  const { url, cuerpo } = peticionDeSesion({ ...datos, carpeta });
  const cliente = cuentaDeServicio();
  const { token } = await cliente.getAccessToken();

  // `Origin` no es decoración: Google solo pone cabeceras de origen cruzado en
  // las respuestas de la sesión si se lo dices AL ABRIRLA. Sin esto, el
  // navegador del estudiante sube el fichero entero, Google lo guarda, y el
  // navegador no puede leer la respuesta: se ve como «Failed to fetch» y la
  // grabación queda en Drive sin fila en la base. Pasó en producción el 12
  // sept 2026, con el fichero ya subido.
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: datos.origen,
    },
    body: cuerpo,
  });
  const sesion = respuesta.headers.get("location");
  if (!respuesta.ok || !sesion) {
    throw new Error(
      `Google no abrió la sesión de subida (${respuesta.status}). Comprueba que la ` +
        "carpeta es una unidad compartida y que la cuenta robot escribe en ella.",
    );
  }
  return sesion;
}

/**
 * Pregunta a Drive por el fichero que dice haber subido quien llama, y solo se
 * fía de lo que responde Drive — nunca de lo que diga el navegador. Misma
 * disciplina que `comprobarQueLlegoAVercel` en lib/ficheros/vercel.ts: sin
 * ella, un estudiante podría escribir una fila `Fichero` reclamando como suya
 * la grabación de OTRO menor con solo conocer su identificador de Drive, y
 * mentir en el tamaño o el tipo al guardar la fila.
 *
 * Devuelve `null` si el fichero no existe, o si existe pero no cuelga de la
 * carpeta de las grabaciones (por ejemplo, el identificador de un fichero de
 * cualquier otro sitio al que la cuenta robot tenga acceso): las dos cosas se
 * tratan igual, como "esto no está confirmado", para no distinguirle a quien
 * llama entre "no existe" y "no es tuyo".
 *
 * Se llama `comprobarQueLlegoADrive`, no `comprobarQueLlego`, para que
 * confundirla con la homónima de lib/ficheros/vercel.ts (contrato distinto:
 * allí la clave es una ruta, aquí un id de Drive) no compile en silencio.
 */
export async function comprobarQueLlegoADrive(id: string): Promise<{ bytes: number; tipoMime: string } | null> {
  const carpeta = process.env.DRIVE_CARPETA_GRABACIONES;
  if (!carpeta) throw new Error("Falta DRIVE_CARPETA_GRABACIONES, el id de la unidad compartida.");

  const cliente = cuentaDeServicio();
  const { token } = await cliente.getAccessToken();

  const respuesta = await fetch(
    `${RAIZ_METADATOS}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=mimeType,size,parents`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(`Google no confirma el fichero de la grabación (${respuesta.status}).`);
  }

  const datos = (await respuesta.json()) as { mimeType?: string; size?: string; parents?: string[] };
  if (!datos.parents?.includes(carpeta)) return null;
  if (!datos.mimeType || !datos.size) return null;

  return { bytes: Number(datos.size), tipoMime: datos.mimeType };
}

/**
 * Qué fila escribir después de una subida. Si Drive no confirma, no hay fila.
 * Los bytes y el tipo salen SIEMPRE de `confirmado` (lo que dice Drive), nunca
 * de `datos` (lo que manda el navegador): `datos` ni siquiera tiene esos
 * campos. `nombreOriginal` sí viene de quien sube (es solo la etiqueta que ve
 * el profesor, no decide nada de seguridad); el nombre de verdad que queda en
 * Drive es el saneado que puso la ruta al pedir la sesión.
 *
 * Se llama `filaDeDriveParaGuardar`, no `filaParaGuardar`, para que
 * confundirla con la homónima de lib/ficheros/vercel.ts (mismo aspecto, pero
 * cada una solo tiene sentido con el `comprobarQueLlegoA...` de su propio
 * almacén: mezclarlas confirmaría una subida contra el almacén equivocado)
 * no compile en silencio.
 */
export function filaDeDriveParaGuardar(
  datos: { ruta: string; nombreOriginal: string; subidoPorId: string },
  confirmado: { bytes: number; tipoMime: string } | null,
) {
  if (!confirmado) return null;
  return {
    almacen: "DRIVE" as const,
    ruta: datos.ruta,
    nombreOriginal: datos.nombreOriginal,
    bytes: confirmado.bytes,
    tipoMime: confirmado.tipoMime,
    subidoPorId: datos.subidoPorId,
  };
}
