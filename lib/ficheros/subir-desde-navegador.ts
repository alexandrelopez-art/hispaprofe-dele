async function mensajeDelError(respuesta: Response, porDefecto: string): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (cuerpo && typeof cuerpo === "object" && "error" in cuerpo && typeof cuerpo.error === "string") {
      return cuerpo.error;
    }
  } catch {
    // el cuerpo no era JSON; se usa el mensaje por defecto
  }
  return porDefecto;
}

/**
 * Sube un fichero directamente al almacén de Vercel: pide permiso a nuestro
 * servidor, sube los bytes a la URL firmada (sin pasar por Vercel, que corta a
 * 4,5 MB) y confirma para que se cree la fila. Devuelve el id del Fichero.
 */
export async function subirAlAlmacen(fichero: File, llamar: typeof fetch = fetch): Promise<string> {
  const permiso = await llamar("/api/ficheros/permiso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: fichero.name, tipoMime: fichero.type, bytes: fichero.size }),
  });
  if (!permiso.ok) throw new Error(await mensajeDelError(permiso, "No se pudo pedir permiso de subida."));
  const { url, ruta } = (await permiso.json()) as { url: string; ruta: string };

  const subida = await llamar(url, { method: "PUT", body: fichero });
  if (!subida.ok) throw new Error("El almacén rechazó la subida.");

  const confirmacion = await llamar("/api/ficheros/confirmar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruta, nombreOriginal: fichero.name }),
  });
  if (!confirmacion.ok) throw new Error(await mensajeDelError(confirmacion, "No se pudo confirmar la subida."));
  const { id } = (await confirmacion.json()) as { id: string };
  return id;
}
