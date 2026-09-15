"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ajustarMarca } from "@/lib/taller/onda";

const ALTO = 120;

/**
 * La onda con sus marcas. Pulsar sobre la onda añade una marca; cada marca se
 * arrastra. Eventos de puntero: vale igual el dedo que el ratón.
 */
export function Onda({
  picos,
  duracion,
  cortes,
  alCambiar,
}: {
  picos: number[];
  duracion: number;
  cortes: number[];
  alCambiar: (cortes: number[]) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [ancho, setAncho] = useState(0);
  const [arrastre, setArrastre] = useState<{ indice: number; t: number } | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.floor(entrada.contentRect.width)));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const c = lienzo.current;
    if (!c || ancho === 0 || picos.length === 0) return;
    const escala = window.devicePixelRatio || 1;
    c.width = ancho * escala;
    c.height = ALTO * escala;
    const g = c.getContext("2d")!;
    g.scale(escala, escala);
    g.clearRect(0, 0, ancho, ALTO);
    g.fillStyle = "#6b7a90";
    for (let x = 0; x < ancho; x++) {
      const alto = Math.max(1, picos[Math.floor((x / ancho) * picos.length)] * ALTO);
      g.fillRect(x, (ALTO - alto) / 2, 1, alto);
    }
  }, [picos, ancho]);

  const tiempoDe = (clientX: number) => {
    const r = caja.current!.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duracion;
  };

  function pulsarOnda(e: PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget && e.target !== lienzo.current) return;
    const t = ajustarMarca(tiempoDe(e.clientX), cortes, duracion);
    if (t !== null) alCambiar([...cortes, t].sort((a, b) => a - b));
  }

  function soltar(indice: number) {
    if (!arrastre || arrastre.indice !== indice) return;
    const otras = cortes.filter((_, j) => j !== indice);
    const t = ajustarMarca(arrastre.t, otras, duracion);
    setArrastre(null);
    if (t !== null) alCambiar([...otras, t].sort((a, b) => a - b));
  }

  return (
    <div ref={caja} data-onda className="relative w-full touch-none select-none rounded-xl bg-hp-50" style={{ height: ALTO }} onPointerDown={pulsarOnda}>
      <canvas ref={lienzo} className="absolute inset-0 h-full w-full" />
      {cortes.map((c, i) => {
        const t = arrastre?.indice === i ? arrastre.t : c;
        return (
          <div
            key={i}
            role="slider"
            aria-label={`Marca ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={Math.round(duracion)}
            aria-valuenow={Math.round(t)}
            className="absolute top-0 h-full w-6 -translate-x-1/2 cursor-ew-resize"
            style={{ left: `${(t / duracion) * 100}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setArrastre({ indice: i, t: c });
            }}
            onPointerMove={(e) => {
              if (arrastre?.indice === i) setArrastre({ indice: i, t: tiempoDe(e.clientX) });
            }}
            onPointerUp={() => soltar(i)}
            onPointerCancel={() => setArrastre(null)}
          >
            <div className="mx-auto h-full w-0.5 bg-error-600" />
          </div>
        );
      })}
    </div>
  );
}
