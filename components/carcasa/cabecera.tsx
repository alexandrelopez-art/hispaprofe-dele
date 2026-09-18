import type { Persona } from "@/lib/generated/prisma";
import { contarPendientes } from "@/lib/carcasa/pendientes";
import { CabeceraVista } from "@/components/carcasa/cabecera-vista";

/** La cabecera de todo el sitio. Sin sesión no se dibuja. */
export async function Cabecera({ persona }: { persona: Persona | null }) {
  if (!persona) return null;
  const pendientes = persona.papel === "PROFESOR" ? await contarPendientes() : null;
  return <CabeceraVista papel={persona.papel} nombre={persona.nombre} pendientes={pendientes} />;
}
