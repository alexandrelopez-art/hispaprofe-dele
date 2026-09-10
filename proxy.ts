import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_DE_COOKIE, exigeSesion } from "@/lib/puerta/rutas";

export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (!exigeSesion(ruta)) return NextResponse.next();
  if (request.cookies.has(NOMBRE_DE_COOKIE)) return NextResponse.next();

  // Una llamada de la propia página no entiende de redirecciones: si le mandas la
  // pantalla de entrar, el navegador se traga un HTML donde esperaba datos.
  if (ruta.startsWith("/api/")) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", request.url), 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
