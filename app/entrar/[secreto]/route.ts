import { NextResponse, type NextRequest } from "next/server";
import { usarEnlace } from "@/lib/puerta/entrada";
import { ponerCookie } from "@/lib/puerta/sesion-http";
import { inicioDe } from "@/lib/carcasa/menu";

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

  // La cookie se pone SOBRE la respuesta que se devuelve, no sobre el
  // almacén de next/headers aparte: ver el comentario de ponerCookie en
  // lib/puerta/sesion-http.ts. Primero se construye la respuesta, luego se
  // le pone la cookie encima.
  // El destino depende del papel: antes todo el mundo iba a "/" y el
  // profesor de ahí saltaba a /pendientes (dos saltos, y en el primero veía
  // un instante el esqueleto del Inicio del estudiante).
  const respuesta = sinCache(NextResponse.redirect(new URL(inicioDe(resultado.papel), request.url), 307));
  ponerCookie(respuesta, resultado.cookie);
  return respuesta;
}
