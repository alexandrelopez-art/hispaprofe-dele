"use client";

import { useState } from "react";

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

export function FormularioDeSubida() {
  const [estado, setEstado] = useState<Estado>({ paso: "listo" });

  async function subir(fichero: File) {
    setEstado({ paso: "subiendo" });
    try {
      const permiso = await fetch("/api/ficheros/permiso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: fichero.name, tipoMime: fichero.type, bytes: fichero.size }),
      });
      if (!permiso.ok) throw new Error(await mensajeDelError(permiso, "No se pudo pedir permiso de subida."));
      const { url, ruta } = (await permiso.json()) as { url: string; ruta: string };

      const subida = await fetch(url, { method: "PUT", body: fichero });
      if (!subida.ok) throw new Error("El almacén rechazó la subida.");

      const confirmacion = await fetch("/api/ficheros/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruta }),
      });
      if (!confirmacion.ok) {
        throw new Error(await mensajeDelError(confirmacion, "No se pudo confirmar la subida."));
      }
      const { id } = (await confirmacion.json()) as { id: string };
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
        accept="image/*,audio/*"
        disabled={estado.paso === "subiendo"}
        onChange={(evento) => {
          const fichero = evento.target.files?.[0];
          if (fichero) void subir(fichero);
        }}
        className="rounded-2xl border border-tinta-suave/30 p-4"
      />
      {estado.paso === "subiendo" && <p className="text-tinta-suave">Subiendo…</p>}
      {estado.paso === "hecho" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">Fichero guardado con id: {estado.id}</p>
      )}
      {estado.paso === "error" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{estado.mensaje}</p>
      )}
    </div>
  );
}
