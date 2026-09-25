"use client";

import { useState, useTransition } from "react";
import { etiquetarPaginasAutomaticamenteAccion } from "@/app/(sitio)/examenes/acciones";
import type { ResultadoDeEtiquetadoAutomatico } from "@/lib/taller/ocr/etiquetar-solo";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

const AVISO_DE_SUSTITUCION =
  "El lector automático va a sustituir las etiquetas que ya tienes puestas a mano por las que detecte. ¿Seguir?";

export function EtiquetarAutomaticamente({ examenId, algunaEtiquetada }: { examenId: string; algunaEtiquetada: boolean }) {
  const [resultado, setResultado] = useState<ResultadoDeEtiquetadoAutomatico | null>(null);
  const [pendiente, empezar] = useTransition();

  function etiquetar() {
    if (algunaEtiquetada && !window.confirm(AVISO_DE_SUSTITUCION)) return;
    setResultado(null);
    empezar(async () => {
      try {
        setResultado(await etiquetarPaginasAutomaticamenteAccion(examenId));
      } catch {
        setResultado({ error: "No se pudo leer el examen. Revisa la conexión y vuelve a pulsar." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={etiquetar} enviando={pendiente} textoEnviando="Leyendo las hojas…">
          Etiquetar automáticamente
        </Boton>
        <span className="text-tinta-suave">El lector OCR reconoce cada hoja: tarda unos segundos por página.</span>
      </div>
      {resultado && "error" in resultado && <Aviso tono="error">{resultado.error}</Aviso>}
      {resultado && !("error" in resultado) && (
        <div role="status">
          <Aviso tono={resultado.inciertas.length > 0 ? "aviso" : "exito"}>
            <p>Etiquetadas {resultado.etiquetadas} de {resultado.paginas} páginas.</p>
            {resultado.inciertas.length > 0 && (
              <>
                <p>
                  El lector no está seguro de {resultado.inciertas.length === 1 ? "esta página" : "estas páginas"}: revísala
                  {resultado.inciertas.length === 1 ? "" : "s"} a mano.
                </p>
                <ul className="list-disc pl-5">
                  {resultado.inciertas.map((p) => (
                    <li key={p.id}>Hoja {p.orden}{p.etiquetas.length > 0 ? ` (${p.etiquetas.join(", ")})` : " (sin etiquetar)"}</li>
                  ))}
                </ul>
              </>
            )}
          </Aviso>
        </div>
      )}
    </div>
  );
}
