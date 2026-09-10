import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// `proxy` es una función pura de petición a respuesta: no hace falta un
// servidor levantado, basta con construir el NextRequest a mano.
//
// Cómo se reconoce cada resultado, comprobado a mano antes de escribir las
// pruebas: NextResponse.next() → status 200 con la cabecera
// `x-middleware-next: 1`; NextResponse.redirect(url, 307) → status 307 con
// `location`; NextResponse.json(cuerpo, { status }) → ese status con
// `content-type: application/json`.

function conCookie(url: string): NextRequest {
  return new NextRequest(url, { headers: { cookie: "hp_sesion=loquesea" } });
}

describe("el guardián (proxy)", () => {
  // Mutación que mata esta prueba: quitar el `if (request.cookies.has(...))
  // return NextResponse.next()`, o cambiar el 307 por otro código, o mandar a
  // otra URL que no sea /entrar.
  it("ruta cerrada sin cookie: redirige a /entrar con 307", () => {
    const res = proxy(new NextRequest("http://x/personas"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://x/entrar");
  });

  // Mutación que mata esta prueba: quitar el chequeo de la cookie (que caería
  // siempre en el redirect o en el 401), o invertir el `.has(...)`.
  it("ruta cerrada con cookie: deja pasar", () => {
    const res = proxy(conCookie("http://x/personas"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  // Mutación que mata esta prueba: quitar el `if (ruta.startsWith("/api/"))`
  // (caería en el redirect, 307 en vez de 401), o devolver otro status.
  it("ruta /api/ sin cookie: 401 con cuerpo de datos, no un redirect", () => {
    const res = proxy(new NextRequest("http://x/api/ficheros/permiso"));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  // Mutación que mata esta prueba: quitar el `if (!exigeSesion(ruta)) return
  // NextResponse.next()` (la portada acabaría en el redirect: status 307 en
  // vez de 200).
  it("ruta abierta: deja pasar aunque no haya cookie", () => {
    const res = proxy(new NextRequest("http://x/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
