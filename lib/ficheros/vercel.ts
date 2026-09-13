import { BlobNotFoundError, del, head, issueSignedToken, presignUrl } from "@vercel/blob";
import type { Papel } from "@/lib/generated/prisma";
import { nombreSaneado } from "./nombres";

export const MINUTOS_DE_SUBIDA = 15;
export const MINUTOS_DE_LECTURA = 5;

const MINUTO = 60_000;

// El material del examen (páginas escaneadas y audios) va todo a la misma
// carpeta por ahora; qué actividad usa cada fichero se resuelve en tareas
// posteriores, con la tabla Pieza. Vive aquí, no en la ruta, para que
// /api/ficheros/permiso y /api/ficheros/confirmar usen siempre la misma.
export const CARPETA_DE_MATERIAL = "material";

/** Un nombre de fichero limpio, dentro de su carpeta y sin forma de salirse de ella. */
export function rutaDelFichero(carpeta: string, nombre: string, aleatorio: string): string {
  return `${carpeta}/${nombreSaneado(nombre, aleatorio)}`;
}

/** Solo páginas escaneadas y audios de examen: nada de vídeo, y nada de SVG (puede llevar un guion, código, dentro). */
export function tipoPermitido(tipoMime: string): boolean {
  if (tipoMime === "image/svg+xml") return false;
  return tipoMime.startsWith("image/") || tipoMime.startsWith("audio/");
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
    // Sin esto la subida firmada le pega al nombre una cola al azar, y el
    // fichero queda en otra ruta: /api/ficheros/confirmar no lo encuentra.
    // La ruta ya lleva su propio aleatorio (rutaDelFichero), no hace falta otro.
    addRandomSuffix: false,
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

/** Borra un fichero del almacén. Solo lo llama quien ya ha borrado su fila y ha visto que nadie más lo usa. */
export async function borrarDeVercel(ruta: string): Promise<void> {
  await del(ruta);
}

/**
 * Qué fila escribir después de una subida. Si el almacén no confirma, no hay fila:
 * una subida cortada no puede dejar un fichero fantasma en la base. Los bytes y el
 * tipo salen SIEMPRE de `confirmado` (lo que dice el almacén), nunca de `datos`
 * (lo que manda el navegador): `datos` ni siquiera tiene esos campos.
 * `nombreOriginal` sí viene de quien sube (es solo la etiqueta que ve el profesor
 * al elegir páginas, no decide nada de seguridad); el nombre de verdad que queda
 * en el almacén es el saneado que puso rutaDelFichero.
 *
 * Se llama `filaDeVercelParaGuardar`, no `filaParaGuardar`, para que confundirla
 * con la homónima de lib/ficheros/drive.ts (contrato distinto: allí la clave es
 * `id`, aquí es `ruta`) no compile en silencio.
 */
export function filaDeVercelParaGuardar(
  datos: { ruta: string; nombreOriginal: string; subidoPorId: string },
  confirmado: { bytes: number; tipoMime: string } | null,
) {
  if (!confirmado) return null;
  return {
    almacen: "VERCEL" as const,
    ruta: datos.ruta,
    nombreOriginal: datos.nombreOriginal,
    bytes: confirmado.bytes,
    tipoMime: confirmado.tipoMime,
    subidoPorId: datos.subidoPorId,
  };
}

/**
 * Nunca se escribe la fila sin preguntar antes al almacén si el fichero está de
 * verdad. Ojo: "no está" (BlobNotFoundError) es el único caso que da `null`. Un
 * error distinto — falta la llave del almacén, un corte de red, lo que sea — se
 * registra y SUBE, para que la petición falle con un 500 visible en vez de decir
 * "no ha llegado" cuando en realidad no se pudo ni preguntar.
 *
 * Se llama `comprobarQueLlegoAVercel`, no `comprobarQueLlego`, por la misma
 * razón que filaDeVercelParaGuardar: hay una homónima en lib/ficheros/drive.ts
 * con contrato distinto (recibe un id de Drive, no una ruta de Vercel).
 */
export async function comprobarQueLlegoAVercel(
  ruta: string,
): Promise<{ bytes: number; tipoMime: string } | null> {
  try {
    const datos = await head(ruta);
    return { bytes: datos.size, tipoMime: datos.contentType };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    console.error("No se pudo comprobar el fichero en el almacén", error);
    throw error;
  }
}
