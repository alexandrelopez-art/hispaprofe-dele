import { notFound } from "next/navigation";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { cerrarLasQueSePasaron, registrarLasVueltas } from "@/lib/examen/hacer";
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
  // Se escribe ANTES de leer, y en este orden:
  //
  // 1. Se cierran las que se pasaron de hora: si no, quien cerró el portátil
  //    vería «a medias» para siempre y no tendría nota nunca.
  // 2. Se cierra la ausencia que hubiera abierta. Cargar esta pantalla YA es
  //    volver: por eso el rastro vive en el servidor y no en el navegador —
  //    cerrar la pestaña no lo borra, pasa por aquí igual.
  //
  // El reloj antes que la vuelta, y no al revés: si se le acabó el tiempo
  // estando fuera, la entrega cierra la ausencia sin contarla (no sabemos cuándo
  // volvió, y apuntarle una ausencia de cincuenta minutos sería inventársela).
  //
  // Acotado a ESTE examen: entrar en la lectura del examen B no puede cerrar una
  // ausencia de la escrita del examen A, que sigue abierta en otra pestaña.
  await cerrarLasQueSePasaron({ personaId: persona.id }, new Date());
  await registrarLasVueltas({ personaId: persona.id, examenId: id }, new Date());
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  return <HacerPrueba prueba={leida} />;
}
