import type { Persona } from "@/lib/generated/prisma";
import { contarPendientes } from "@/lib/carcasa/pendientes";
import { CabeceraVista } from "@/components/carcasa/cabecera-vista";

/**
 * La cabecera de todo el sitio. Sin sesión no se dibuja.
 *
 * Ojo: además de pintarse como <Cabecera>, se llama como FUNCIÓN
 * (`await Cabecera({ persona })`) desde app/examen/[id]/[prueba]/page.tsx.
 * Llamada así no hay render de React debajo, así que aquí no puede haber
 * hooks ni nada que dependa del contexto de render: lo que lo necesite va en
 * CabeceraVista, que sí se pinta como componente.
 */
export async function Cabecera({ persona }: { persona: Persona | null }) {
  if (!persona) return null;
  const pendientes = persona.papel === "PROFESOR" ? await contarPendientes() : null;
  return <CabeceraVista papel={persona.papel} nombre={persona.nombre} pendientes={pendientes} />;
}
