"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarCuadernilloAccion } from "@/app/examenes/acciones";
import { trozosDePdf } from "@/lib/taller/pdf-en-navegador";

export function SubirCuadernillo({ examenId }: { examenId: string }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function alElegir(fichero: File | undefined) {
    if (!fichero) return;
    if (!titulo.trim()) {
      setAviso("Pon antes un título al cuadernillo.");
      return;
    }
    setOcupado(true);
    setAviso("Leyendo el PDF…");
    try {
      const r = await guardarCuadernilloAccion(examenId, titulo, await trozosDePdf(fichero));
      if (r.error) setAviso(r.error);
      else {
        setAviso(null);
        router.refresh();
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido leer el PDF.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-bold">Título del cuadernillo</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Libro de preparación, soluciones" className="rounded-2xl border border-tinta-suave/30 bg-white p-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">PDF del cuadernillo (con texto, no escaneado)</span>
        <input
          type="file"
          accept="application/pdf"
          disabled={ocupado}
          onChange={(e) => {
            const fichero = e.target.files?.[0];
            e.target.value = "";
            void alElegir(fichero);
          }}
          className="rounded-2xl border border-tinta-suave/30 bg-white p-3"
        />
      </label>
      {aviso && <p role="status" className="rounded-2xl bg-hp-50 p-4">{aviso}</p>}
    </div>
  );
}
