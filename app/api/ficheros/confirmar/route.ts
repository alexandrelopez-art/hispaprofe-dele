import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import {
  CARPETA_DE_MATERIAL,
  comprobarQueLlego,
  filaParaGuardar,
  puedeSubirMaterial,
} from "@/lib/ficheros/vercel";

const cuerpo = z.object({ ruta: z.string().min(1) });

function esClaveDuplicada(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

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
  const { ruta } = datos.data;

  // No se confirma cualquier ruta: tiene que colgar de la carpeta donde
  // /api/ficheros/permiso concede permisos. Sin esto, confirmar aceptaría
  // como fila válida cualquier cadena que alguien decida mandar.
  if (!ruta.startsWith(`${CARPETA_DE_MATERIAL}/`)) {
    return NextResponse.json({ error: "Esa ruta no pertenece al almacén de material." }, { status: 400 });
  }

  const confirmado = await comprobarQueLlego(ruta);
  const fila = filaParaGuardar({ ruta, subidoPorId: persona.id }, confirmado);
  if (!fila) {
    return NextResponse.json(
      { error: "El almacén no confirma que el fichero haya llegado todavía." },
      { status: 422 },
    );
  }

  try {
    const fichero = await prisma.fichero.create({ data: fila });
    return NextResponse.json({ id: fichero.id });
  } catch (error) {
    // Un doble clic manda la misma confirmación dos veces: la segunda choca
    // con la clave única (almacen, ruta). No es un fallo, es la misma
    // subida contada dos veces; se devuelve la fila que ya existe.
    if (esClaveDuplicada(error)) {
      const existente = await prisma.fichero.findUniqueOrThrow({
        where: { almacen_ruta: { almacen: fila.almacen, ruta: fila.ruta } },
      });
      return NextResponse.json({ id: existente.id });
    }
    throw error;
  }
}
