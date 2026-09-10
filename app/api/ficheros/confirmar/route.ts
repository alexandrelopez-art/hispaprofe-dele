import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { comprobarQueLlego, filaParaGuardar, puedeSubirMaterial } from "@/lib/ficheros/vercel";

const cuerpo = z.object({ ruta: z.string().min(1) });

/**
 * Confirma una subida y crea la fila Fichero. Los bytes y el tipo que se
 * guardan salen SIEMPRE de lo que responde el almacén (comprobarQueLlego),
 * nunca de lo que diga el navegador: eso es lo que prueba
 * tests/ficheros-vercel.test.ts, y aquí es donde importa de verdad.
 */
export async function POST(request: NextRequest) {
  const persona = await personaDeLaPeticion();
  if (!persona) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }
  if (!puedeSubirMaterial(persona.papel)) {
    return NextResponse.json({ error: "Solo el profesor puede subir material." }, { status: 403 });
  }

  const cuerpoRecibido = await request.json().catch(() => null);
  const datos = cuerpo.safeParse(cuerpoRecibido);
  if (!datos.success) {
    return NextResponse.json({ error: "Datos de la petición incompletos o inválidos." }, { status: 400 });
  }

  const confirmado = await comprobarQueLlego(datos.data.ruta);
  const fila = filaParaGuardar({ ruta: datos.data.ruta, subidoPorId: persona.id }, confirmado);
  if (!fila) {
    return NextResponse.json(
      { error: "El almacén no confirma que el fichero haya llegado todavía." },
      { status: 422 },
    );
  }

  const fichero = await prisma.fichero.create({ data: fila });
  return NextResponse.json({ id: fichero.id });
}
