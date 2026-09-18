"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { comprobarQueLlegoADrive, filaDeDriveParaGuardar } from "@/lib/ficheros/drive";

const datosDeLaGrabacion = z.object({
  ruta: z.string().min(1),
  nombreOriginal: z.string().min(1).max(255),
});

/**
 * Guarda la fila `Fichero` de una grabación que ya terminó de subir a Drive.
 * Es una acción de servidor, así que se puede llamar sin pasar por la
 * pantalla: por eso vuelve a comprobar la sesión aquí, igual que
 * `crearPersona` en app/(sitio)/estudiantes/acciones.ts.
 *
 * `bytes` y `tipoMime` NO se reciben de quien llama: se preguntan a Drive
 * (`comprobarQueLlegoADrive`), igual que `/api/ficheros/confirmar` pregunta
 * al almacén de Vercel antes de guardar. Sin esa pregunta, cualquiera con
 * sesión podría escribir una fila reclamando como suya la grabación de OTRO
 * con solo conocer su identificador de Drive, y mentir en el tamaño.
 */
export async function guardarGrabacion(datos: { ruta: string; nombreOriginal: string }): Promise<string> {
  const persona = await personaDeLaPeticion();
  if (!persona) throw new Error("Hay que entrar.");

  const validado = datosDeLaGrabacion.parse(datos);
  const confirmado = await comprobarQueLlegoADrive(validado.ruta);
  const fila = filaDeDriveParaGuardar({ ...validado, subidoPorId: persona.id }, confirmado);
  if (!fila) {
    throw new Error(
      "Drive no confirma que esa grabación esté en la carpeta de las grabaciones. No se guardó.",
    );
  }

  const fichero = await prisma.fichero.create({ data: fila });
  return fichero.id;
}
