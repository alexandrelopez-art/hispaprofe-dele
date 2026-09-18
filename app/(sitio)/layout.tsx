import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { Cabecera } from "@/components/carcasa/cabecera";

/**
 * La cabecera de todas las pantallas con sesión. `/examen/…`, `/entrar` y
 * `/salir` quedan FUERA de este grupo a propósito: la prueba dibuja su propia
 * cabecera mientras corre el reloj (spec §5), y entrar no lleva ninguna.
 *
 * Los layouts no se vuelven a pintar al navegar entre sus pantallas: el número
 * de Pendientes se refresca al recargar, al entrar y cuando una acción llama a
 * `revalidatePath("/", "layout")` (firmar una corrección lo hace).
 */
export default async function LayoutDelSitio({ children }: { children: React.ReactNode }) {
  const persona = await personaDeLaPeticion();
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera persona={persona} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
