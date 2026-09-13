"use client";

import { useState } from "react";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";

type Estado =
  | { paso: "listo" }
  | { paso: "subiendo" }
  | { paso: "hecho"; id: string }
  | { paso: "error"; mensaje: string };

export function FormularioDeSubida() {
  const [estado, setEstado] = useState<Estado>({ paso: "listo" });

  async function subir(fichero: File) {
    setEstado({ paso: "subiendo" });
    try {
      setEstado({ paso: "hecho", id: await subirAlAlmacen(fichero) });
    } catch (error) {
      setEstado({ paso: "error", mensaje: error instanceof Error ? error.message : "Fallo desconocido." });
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
