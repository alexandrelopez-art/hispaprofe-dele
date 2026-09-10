"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";

const datosDeLaGrabacion = z.object({
  ruta: z.string().min(1),
  tipoMime: z.string().min(1),
  bytes: z.number().int().positive(),
});

/**
 * Guarda la fila `Fichero` de una grabación que ya terminó de subir a Drive.
 * Es una acción de servidor, así que se puede llamar sin pasar por la
 * pantalla: por eso vuelve a comprobar la sesión aquí, igual que
 * `crearPersona` en app/personas/acciones.ts.
 *
 * A diferencia del almacén de Vercel (donde /api/ficheros/confirmar
 * pregunta al propio almacén por los bytes y el tipo reales antes de
 * guardar), aquí `bytes` y `tipoMime` vienen de lo que dice el navegador que
 * acaba de terminar la subida: esta es la pantalla de pruebas que se tira
 * cuando llegue el taller, y ese taller es quien tiene que decidir cómo se
 * confirma una grabación contra Drive (una llamada a `files.get` con
 * `supportsAllDrives=true`, previsiblemente).
 */
export async function guardarGrabacion(datos: {
  ruta: string;
  tipoMime: string;
  bytes: number;
}): Promise<string> {
  const persona = await personaDeLaPeticion();
  if (!persona) throw new Error("Hay que entrar.");

  const validado = datosDeLaGrabacion.parse(datos);
  const fichero = await prisma.fichero.create({
    data: {
      almacen: "DRIVE",
      ruta: validado.ruta,
      tipoMime: validado.tipoMime,
      bytes: validado.bytes,
      subidoPorId: persona.id,
    },
  });
  return fichero.id;
}
