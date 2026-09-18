"use client";

import { useState } from "react";
import { guardarGrabacion } from "./acciones";

type Estado =
  | { paso: "listo" }
  | { paso: "subiendo" }
  | { paso: "hecho"; id: string }
  | { paso: "error"; mensaje: string };

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

export function FormularioDeGrabacion() {
  const [estado, setEstado] = useState<Estado>({ paso: "listo" });

  async function subir(fichero: File) {
    setEstado({ paso: "subiendo" });
    try {
      // El fetch a /api/grabaciones/permiso es lo único que decide DÓNDE
      // acaba subiendo el fichero (ver el comentario de
      // lib/ficheros/drive.ts): hoy esa ruta devuelve una sesión de Drive y
      // el PUT de aquí abajo manda el fichero entero de una vez. Si el día
      // de mañana la sesión apunta a un endpoint propio que trocea, ESTE PUT
      // sí tiene que cambiar: convertirse en un bucle que suba trozos por
      // debajo de 4,5 MB con su cabecera Content-Range. Hoy ese troceo no
      // existe.
      const permiso = await fetch("/api/grabaciones/permiso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: fichero.name, tipoMime: fichero.type, bytes: fichero.size }),
      });
      if (!permiso.ok) throw new Error(await mensajeDelError(permiso, "No se pudo pedir la sesión de subida."));
      const { url } = (await permiso.json()) as { url: string };

      const subida = await fetch(url, { method: "PUT", body: fichero });
      if (!subida.ok) throw new Error("Drive rechazó la subida.");
      const confirmado = (await subida.json()) as { id: string };

      // bytes y tipoMime no se mandan aquí: guardarGrabacion se los
      // pregunta a Drive. nombreOriginal sí es tal cual lo escribió quien
      // sube (no decide nada de seguridad, es solo la etiqueta que verá el
      // profesor).
      const id = await guardarGrabacion({ ruta: confirmado.id, nombreOriginal: fichero.name });
      setEstado({ paso: "hecho", id });
    } catch (error) {
      setEstado({
        paso: "error",
        mensaje: error instanceof Error ? error.message : "Fallo desconocido.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept="audio/*,video/*"
        disabled={estado.paso === "subiendo"}
        onChange={(evento) => {
          const fichero = evento.target.files?.[0];
          if (fichero) void subir(fichero);
        }}
        className="rounded-2xl border border-tinta-suave/30 p-4"
      />
      {estado.paso === "subiendo" && <p className="text-tinta-suave">Subiendo…</p>}
      {estado.paso === "hecho" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">Grabación guardada con id: {estado.id}</p>
      )}
      {estado.paso === "error" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{estado.mensaje}</p>
      )}
    </div>
  );
}
