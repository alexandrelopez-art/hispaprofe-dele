import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

const dobles = vi.hoisted(() => ({
  ruta: { actual: "/" },
  escritosPorCorregir: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => dobles.ruta.actual }));
vi.mock("@/lib/examen/corregir", () => ({ escritosPorCorregir: dobles.escritosPorCorregir }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { Cabecera } from "@/components/carcasa/cabecera";
import { PanelMovil } from "@/components/carcasa/cabecera-vista";
import { contarPendientes } from "@/lib/carcasa/pendientes";
import { enlacesDe } from "@/lib/carcasa/menu";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

async function pintar(persona: Persona | null): Promise<string> {
  const elemento = await Cabecera({ persona });
  return elemento ? renderToStaticMarkup(elemento) : "";
}

/** Los href de los enlaces de navegación (los que llevan data-menu) del menú
 *  de ESCRITORIO. El panel del móvil se pinta siempre (oculto con `hidden`,
 *  para que `aria-controls` apunte a algo que existe) y repite los mismos
 *  enlaces: contar en la página entera los daría dos veces. Se recorta el
 *  <nav> marcado con data-menu-escritorio y la comparación sigue siendo exacta. */
function hrefsDelMenu(pagina: string): string[] {
  const nav = pagina.match(/<nav[^>]*data-menu-escritorio=""[^>]*>[\s\S]*?<\/nav>/);
  expect(nav, "no hay menú de escritorio").not.toBeNull();
  const html = nav![0];
  return [...html.matchAll(/<a[^>]*data-menu=""[^>]*href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*data-menu=""/g)].map((m) => m[1] ?? m[2]!);
}

beforeEach(() => {
  vi.resetAllMocks();
  dobles.ruta.actual = "/";
  dobles.escritosPorCorregir.mockResolvedValue([]);
});

describe("la cabecera", () => {
  // Mutación que la mata: pintar la cabecera sin sesión (la pantalla de
  // entrar y la página sin sesión no la llevan).
  it("sin sesión no se dibuja", async () => {
    expect(await pintar(null)).toBe("");
  });

  // Mutación que la mata: pintar al estudiante el menú del profesor, o
  // cualquier enlace de más. Es la regla dura: ni un enlace que no toque.
  it("el estudiante ve solo Inicio, y ningún enlace de profesor", async () => {
    const html = await pintar(ESTUDIANTE);
    expect(hrefsDelMenu(html)).toEqual(["/"]);
    for (const ajeno of ["/examenes", "/estudiantes", "/pendientes", "/muestrario", "/pruebas/grabar"]) {
      expect(html).not.toContain(`href="${ajeno}"`);
    }
  });

  // Mutación que la mata: olvidar un enlace del profesor o meter uno de más.
  it("el profesor ve Exámenes, Estudiantes y Pendientes", async () => {
    expect(hrefsDelMenu(await pintar(PROFESOR))).toEqual(["/examenes", "/estudiantes", "/pendientes"]);
  });

  // Mutación que la mata: que la marca lleve siempre a "/" (el profesor
  // caería en su redirección, un salto de más).
  it("la marca lleva al inicio de cada papel", async () => {
    expect(await pintar(PROFESOR)).toMatch(/<a[^>]*href="\/pendientes"[^>]*>[^<]*HispaProfe/);
    expect(await pintar(ESTUDIANTE)).toMatch(/<a[^>]*href="\/"[^>]*>[^<]*HispaProfe/);
  });

  // Mutación que la mata: no marcar la sección activa (aria-current).
  it("marca la sección en la que se está", async () => {
    dobles.ruta.actual = "/examenes/x1";
    expect(await pintar(PROFESOR)).toMatch(/<a[^>]*href="\/examenes"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/examenes"/);
  });

  // Mutación que la mata: pintar el número siempre, o no pintarlo nunca; o
  // volver al aria-label sobre un <span> sin papel (los lectores de pantalla
  // lo ignoran): el texto para ellos va en sr-only y el número visible, oculto
  // a ellos para que no lo lean dos veces.
  it("el número de Pendientes: con texto para lectores de pantalla, y sin dibujar el cero", async () => {
    dobles.escritosPorCorregir.mockResolvedValue([{}, {}, {}]);
    const conTres = await pintar(PROFESOR);
    expect(conTres).toContain('<span class="sr-only">Por corregir: 3</span>');
    expect(conTres).toMatch(/<span aria-hidden="true"[^>]*>3<\/span>/);
    expect(conTres).not.toContain('aria-label="Por corregir');
    dobles.escritosPorCorregir.mockResolvedValue([]);
    expect(await pintar(PROFESOR)).not.toContain("Por corregir:");
  });

  // Mutación que la mata: pedir la cola también para el estudiante.
  it("al estudiante no se le cuenta nada", async () => {
    await pintar(ESTUDIANTE);
    expect(dobles.escritosPorCorregir).not.toHaveBeenCalled();
  });

  // Mutación que la mata: dejar que el fallo de la cuenta suba (tumbaría
  // TODAS las pantallas del profesor por un número).
  it("si la cuenta falla, la cabecera sale sin número", async () => {
    dobles.escritosPorCorregir.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await contarPendientes()).toBeNull();
    const html = await pintar(PROFESOR);
    expect(html).toContain('href="/pendientes"');
    expect(html).not.toContain("Por corregir:");
  });

  // Mutación que la mata: quitar el formulario de salir del menú del nombre.
  it("salir es un POST a /salir", async () => {
    expect(await pintar(ESTUDIANTE)).toMatch(/<form[^>]*action="\/salir"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/salir"/);
  });
});

describe("el panel del móvil", () => {
  // Mutación que la mata: no pintar los enlaces o el salir dentro del panel.
  it("abierto, lleva los enlaces, el nombre, salir y la ✕", () => {
    const html = renderToStaticMarkup(
      <PanelMovil abierto enlaces={enlacesDe("PROFESOR")} activa="/pendientes" nombre="Pablo" pendientes={2} alCerrar={() => {}} />,
    );
    expect(html).toContain('href="/examenes"');
    expect(html).toContain('href="/pendientes"');
    expect(html).toContain("Pablo");
    expect(html).toContain('action="/salir"');
    expect(html).toContain('aria-label="Cerrar el menú"');
    expect(html).toContain('<span class="sr-only">Por corregir: 2</span>');
    expect(html).not.toMatch(/<div[^>]*id="panel-del-menu"[^>]*\shidden=""/);
  });

  // Mutación que la mata: volver a montar el panel solo al abrirlo (el
  // aria-controls="panel-del-menu" del botón Menú apuntaría a nada), o
  // pintarlo cerrado sin `hidden` (se vería encima de la página).
  it("cerrado, está en la página pero oculto, y el botón Menú apunta a él", async () => {
    const html = await pintar(PROFESOR);
    expect(html).toMatch(/<button[^>]*aria-controls="panel-del-menu"/);
    const panel = html.match(/<div[^>]*id="panel-del-menu"[^>]*>/);
    expect(panel, "el panel no está en la página").not.toBeNull();
    expect(panel![0]).toMatch(/\shidden=""/);
  });
});
