import { JWT } from "google-auth-library";

// ÚNICO sitio donde se decide POR DÓNDE viajan los bytes de una grabación.
// Hoy `abrirSesionDeSubida` abre una sesión reanudable de Drive y el
// navegador del estudiante sube directo ahí con un PUT (ver
// app/pruebas/grabar/formulario.tsx: pide una URL y le hace PUT, sin saber
// de dónde es esa URL). El supuesto sin comprobar (Step 0 del encargo, no se
// puede hacer todavía porque faltan la cuenta robot y la unidad compartida)
// es que Google admita esa subida entre orígenes. Si no lo admitiera, el
// plan de reserva es que ESTA función deje de devolver la dirección de
// Google y devuelva en su lugar la de un endpoint propio que reciba los
// trozos (cada uno por debajo de los 4,5 MB) y los reenvíe a Drive con la
// cuenta de servicio. Ni la ruta (app/api/grabaciones/permiso/route.ts) ni
// la pantalla tendrían que cambiar: las dos ya se limitan a "pide una URL,
// sube los bytes ahí".
const RAIZ = "https://www.googleapis.com/upload/drive/v3/files";

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
}): Promise<string> {
  const carpeta = process.env.DRIVE_CARPETA_GRABACIONES;
  if (!carpeta) throw new Error("Falta DRIVE_CARPETA_GRABACIONES, el id de la unidad compartida.");

  const { url, cuerpo } = peticionDeSesion({ ...datos, carpeta });
  const cliente = cuentaDeServicio();
  const { token } = await cliente.getAccessToken();

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
