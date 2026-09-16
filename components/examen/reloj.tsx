"use client";

import { useEffect, useState } from "react";

/**
 * La cuenta atrás. Solo pinta: los segundos de verdad los da el servidor al
 * cargar la pantalla, y este componente los va restando. Si el estudiante le
 * cambia la hora al móvil no pasa nada, porque cada escritura vuelve a
 * comprobar el tiempo contra el reloj del servidor.
 */
export function Reloj({ segundos, alAcabarse }: { segundos: number; alAcabarse: () => void }) {
  const [quedan, setQuedan] = useState(segundos);

  useEffect(() => {
    if (quedan <= 0) { alAcabarse(); return; }
    const t = setTimeout(() => setQuedan((q) => q - 1), 1000);
    return () => clearTimeout(t);
  }, [quedan, alAcabarse]);

  const minutos = Math.floor(quedan / 60);
  const resto = quedan % 60;
  return (
    <p data-reloj={quedan} className={`font-bold ${quedan <= 300 ? "text-error-600" : ""}`}>
      {`Te quedan ${minutos}:${String(resto).padStart(2, "0")}`}
    </p>
  );
}
