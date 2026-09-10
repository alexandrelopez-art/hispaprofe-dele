import { NextResponse, type NextRequest } from "next/server";
import { usarEnlace } from "@/lib/puerta/entrada";
import { ponerCookie } from "@/lib/puerta/sesion-http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secreto: string }> },
) {
  const { secreto } = await params;
  const resultado = await usarEnlace(secreto, new Date());

  if ("error" in resultado) {
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("fallo", resultado.error === "desconocido" ? "caducado" : resultado.error);
    return NextResponse.redirect(destino, 307);
  }

  await ponerCookie(resultado.cookie);
  return NextResponse.redirect(new URL("/", request.url), 307);
}
