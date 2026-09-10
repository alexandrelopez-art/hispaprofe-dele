import { NextResponse, type NextRequest } from "next/server";
import { usarEnlace } from "@/lib/puerta/entrada";
import { ponerCookie } from "@/lib/puerta/sesion-http";

// El secreto va en la propia dirección y la respuesta trae una cookie de
// sesión: ninguna caché intermedia debe guardar ninguna de las dos.
function sinCache(respuesta: NextResponse): NextResponse {
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secreto: string }> },
) {
  const { secreto } = await params;
  const resultado = await usarEnlace(secreto, new Date());

  if ("error" in resultado) {
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("fallo", resultado.error === "desconocido" ? "caducado" : resultado.error);
    return sinCache(NextResponse.redirect(destino, 307));
  }

  await ponerCookie(resultado.cookie);
  return sinCache(NextResponse.redirect(new URL("/", request.url), 307));
}
