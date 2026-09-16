"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lo que queda, en segundos, contra el reloj de la máquina. Pura y con el
 * «ahora» por argumento: es la única parte del reloj que se puede probar sin
 * temporizadores. El `Math.max(0, ...)` no es adorno — un móvil que vuelve
 * pasada la hora trae una diferencia negativa, y sin él la pantalla pintaría
 * «Te quedan -3:-20».
 */
export function segundosHasta(limite: number, ahora: number): number {
  return Math.max(0, Math.round((limite - ahora) / 1000));
}

/**
 * La cuenta atrás. Solo pinta: los segundos de verdad los da el servidor al
 * cargar la pantalla, y cada escritura vuelve a comprobar el tiempo contra el
 * reloj del servidor, así que cambiarle la hora al móvil no regala nada.
 *
 * Lo que se guarda al montar es la HORA DE FIN, no un contador que se va
 * restando. Un móvil bloqueado o con la pestaña de fondo suspende o ralentiza
 * los temporizadores: restando de un contador, cinco minutos con la pantalla
 * apagada serían cinco minutos regalados en pantalla, y la primera respuesta
 * que marcara después le devolvería «Se acabó el tiempo.» del servidor, que sí
 * llevaba la cuenta buena — con el formulario congelado y un cartel rojo. Con
 * una hora de fin, la vuelta que llega tarde pone el número en su sitio sola.
 *
 * Si cambia `segundos` (la pantalla se refresca y el servidor manda una cuenta
 * nueva), la hora de fin se vuelve a sembrar: manda siempre el servidor.
 */
export function Reloj({ segundos, alAcabarse }: { segundos: number; alAcabarse: () => void }) {
  const [quedan, setQuedan] = useState(segundos);
  // El aviso, en una ref, y FUERA de las dependencias del efecto de abajo: si
  // entrara, un cambio de identidad de `alAcabarse` volvería a sembrar la hora
  // de fin y regalaría tiempo en pantalla. Hoy no cambia (viene de un
  // useCallback), pero de eso no debe depender el reloj.
  const avisar = useRef(alAcabarse);
  useEffect(() => {
    avisar.current = alAcabarse;
  }, [alAcabarse]);

  useEffect(() => {
    // La hora de fin se siembra aquí, una sola vez por cada cuenta que manda
    // el servidor. `avisado` es de este mismo cierre: con una cuenta nueva, el
    // efecto se vuelve a montar y el aviso queda armado otra vez solo.
    const hora = Date.now() + segundos * 1000;
    let avisado = false;
    // Un intervalo, no un setTimeout encadenado que dependa de que `quedan`
    // cambie: si dos vueltas dieran el mismo número, el encadenado se pararía
    // para siempre sin que nadie se enterara.
    const tic = () => {
      const q = segundosHasta(hora, Date.now());
      setQuedan(q);
      if (q > 0 || avisado) return;
      avisado = true;
      avisar.current();
    };
    // La primera vuelta, en cuanto se pueda y no dentro de un segundo: si el
    // servidor manda una cuenta ya en cero (pasa dentro de los diez segundos
    // de gracia), la prueba se entrega sola sin esperar. Va en un temporizador
    // y no aquí mismo para no llamar a setQuedan en mitad del efecto.
    const primera = setTimeout(tic, 0);
    const id = setInterval(tic, 1000);
    return () => {
      clearTimeout(primera);
      clearInterval(id);
    };
  }, [segundos]);

  const minutos = Math.floor(quedan / 60);
  const resto = quedan % 60;
  return (
    <p data-reloj={quedan} className={`font-bold ${quedan <= 300 ? "text-error-600" : ""}`}>
      {`Te quedan ${minutos}:${String(resto).padStart(2, "0")}`}
    </p>
  );
}
