import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { escritoParaCorregir } from "@/lib/examen/corregir";
import { CorregirEscrita } from "@/components/examen/corregir-escrita";

/**
 * La otra mitad de la puerta de /corregir: `lib/examen/corregir.ts` no
 * comprueba papeles, así que sin este `exigirProfesor` un estudiante que
 * adivine (o se pase) el id de un compañero vería su redacción entera y sus
 * notas con solo escribir la dirección.
 */
export default async function PantallaDeCorregir({
  params,
}: {
  params: Promise<{ intentoId: string }>;
}) {
  await exigirProfesor();
  const { intentoId } = await params;
  const para = await escritoParaCorregir(intentoId, new Date());
  if (!para) notFound();
  return <CorregirEscrita para={para} />;
}
