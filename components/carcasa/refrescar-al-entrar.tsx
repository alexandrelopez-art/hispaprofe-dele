"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Pide al servidor la página otra vez, UNA vez, al montarse. Existe por el
 * número de Pendientes de la cabecera: el layout de app/(sitio)/ no se
 * repinta al navegar entre sus páginas, y la cola crece por caminos que no
 * pasan por firmar (un estudiante entrega; `cerrarLasQueSePasaron` al pintar
 * /examenes/[id]). Montado en /pendientes, el número y la lista coinciden al
 * llegar. La marca `data-refrescar` es para las pruebas: sin jsdom el efecto
 * no corre, y así se puede ver que la página lo lleva.
 */
export function RefrescarAlEntrar() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    // Vacías a propósito: una vez al entrar, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span data-refrescar="" hidden />;
}
