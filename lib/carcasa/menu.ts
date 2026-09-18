// lib/carcasa/menu.ts
import type { Persona } from "@/lib/generated/prisma";

export type Papel = Persona["papel"];
export type EnlaceDelMenu = { href: string; texto: string; conContador?: true };

/**
 * Los menús, y ni un enlace más. Regla dura del sitio: no se dibuja el enlace a
 * una sección que todavía no funciona (el sitio viejo murió enseñando cuatro
 * bloques con tres «en preparación»). Practicar, Mis resultados y Biblioteca
 * entran aquí el día que existan, no antes.
 */
const MENUS: Record<Papel, EnlaceDelMenu[]> = {
  ESTUDIANTE: [{ href: "/", texto: "Inicio" }],
  PROFESOR: [
    { href: "/examenes", texto: "Exámenes" },
    { href: "/estudiantes", texto: "Estudiantes" },
    { href: "/pendientes", texto: "Pendientes", conContador: true },
  ],
};

export function enlacesDe(papel: Papel): EnlaceDelMenu[] {
  return MENUS[papel];
}

/** A dónde lleva la marca «HispaProfe» y dónde cae cada uno al entrar. */
export function inicioDe(papel: Papel): string {
  return papel === "PROFESOR" ? "/pendientes" : "/";
}

/** El href de la sección en la que se está, o null. "/" solo cuenta exacta. */
export function seccionActiva(ruta: string, enlaces: EnlaceDelMenu[]): string | null {
  const activa = enlaces.find((e) =>
    e.href === "/" ? ruta === "/" : ruta === e.href || ruta.startsWith(`${e.href}/`),
  );
  return activa?.href ?? null;
}

/** Mientras la prueba no está entregada corre (o puede correr) un reloj, y la
 *  cabecera normal estorba. Entregada, lo que hay es un resultado. */
export function usaCabeceraDelExamen(entregada: boolean): boolean {
  return !entregada;
}
