import { notFound } from "next/navigation";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { cerrarLasQueSePasaron } from "@/lib/examen/hacer";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";
import { HacerPrueba } from "@/components/examen/hacer-prueba";

export default async function PantallaDelExamen({
  params,
}: {
  params: Promise<{ id: string; prueba: string }>;
}) {
  const persona = await exigirPersona();
  const { id, prueba } = await params;
  if (!esPrueba(prueba)) notFound();
  // Primero se cierran las que se pasaron de hora: si no, quien cerró el
  // portátil vería «a medias» para siempre y no tendría nota nunca.
  await cerrarLasQueSePasaron({ personaId: persona.id }, new Date());
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  return <HacerPrueba prueba={leida} />;
}
