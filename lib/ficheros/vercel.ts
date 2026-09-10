import { head, issueSignedToken, presignUrl } from "@vercel/blob";
import type { Papel } from "@/lib/generated/prisma";

export const MINUTOS_DE_SUBIDA = 15;
export const MINUTOS_DE_LECTURA = 5;

const MINUTO = 60_000;

/** Un nombre de fichero limpio, dentro de su carpeta y sin forma de salirse de ella. */
export function rutaDelFichero(carpeta: string, nombre: string, aleatorio: string): string {
  const punto = nombre.lastIndexOf(".");
  const extension = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : "bin";
  const base = (punto > 0 ? nombre.slice(0, punto) : nombre)
    .split(/[\\/]/)
    .pop()!
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${carpeta}/${base}-${aleatorio}.${extension}`;
}

/**
 * Un permiso de subida de corta vida: el navegador sube directamente al
 * almacén con esta URL, sin pasar los bytes por nuestro servidor.
 *
 * El paquete instalado (@vercel/blob 2.8.0) no tiene la forma que se
 * imaginó al escribir el encargo. `issueSignedToken` e `presignUrl` SÍ
 * existen con esos nombres, pero:
 *  - `validUntil` de `issueSignedToken` es un número de milisegundos desde
 *    epoch, no un `Date`.
 *  - `issueSignedToken` devuelve `{ delegationToken, clientSigningToken,
 *    validUntil }`; a `presignUrl` hay que pasarle el objeto con los DOS
 *    campos (`delegationToken` y `clientSigningToken`), no solo uno.
 *  - `presignUrl` es asíncrona, exige `access: "private" | "public"` en las
 *    opciones, y devuelve `Promise<{ presignedUrl: string }>`, no una
 *    cadena suelta.
 */
export async function permisoDeSubida(
  ruta: string,
  tipos: string[],
  maxBytes: number,
  ahora: Date,
): Promise<{ url: string; validoHasta: Date }> {
  const validoHasta = new Date(ahora.getTime() + MINUTOS_DE_SUBIDA * MINUTO);
  const firmado = await issueSignedToken({
    pathname: ruta,
    operations: ["put"],
    validUntil: validoHasta.getTime(),
    allowedContentTypes: tipos,
    maximumSizeInBytes: maxBytes,
  });
  const { presignedUrl } = await presignUrl(firmado, {
    operation: "put",
    pathname: ruta,
    access: "private",
  });
  return { url: presignedUrl, validoHasta };
}

/** Un enlace de lectura de vida muy corta. Nunca dura más de MINUTOS_DE_LECTURA. */
export async function enlaceDeLectura(ruta: string, ahora: Date): Promise<string> {
  const validoHasta = new Date(ahora.getTime() + MINUTOS_DE_LECTURA * MINUTO);
  const firmado = await issueSignedToken({
    pathname: ruta,
    operations: ["get"],
    validUntil: validoHasta.getTime(),
  });
  const { presignedUrl } = await presignUrl(firmado, {
    operation: "get",
    pathname: ruta,
    access: "private",
  });
  return presignedUrl;
}

export function puedeSubirMaterial(papel: Papel): boolean {
  return papel === "PROFESOR";
}

/**
 * Qué fila escribir después de una subida. Si el almacén no confirma, no hay fila:
 * una subida cortada no puede dejar un fichero fantasma en la base.
 */
export function filaParaGuardar(
  datos: { ruta: string; subidoPorId: string; bytesSegunElNavegador?: number },
  confirmado: { bytes: number; tipoMime: string } | null,
) {
  if (!confirmado) return null;
  return {
    almacen: "VERCEL" as const,
    ruta: datos.ruta,
    bytes: confirmado.bytes,
    tipoMime: confirmado.tipoMime,
    subidoPorId: datos.subidoPorId,
  };
}

/** Nunca se escribe la fila sin preguntar antes al almacén si el fichero está de verdad. */
export async function comprobarQueLlego(
  ruta: string,
): Promise<{ bytes: number; tipoMime: string } | null> {
  try {
    const datos = await head(ruta);
    return { bytes: datos.size, tipoMime: datos.contentType };
  } catch {
    return null;
  }
}
