"use client";

import { createContext, useContext } from "react";
import type { Ruta } from "@/lib/taller/editar";
import { claveDeRuta } from "@/lib/taller/ia/dudas";

/** Las dudas de la IA por clave de campo («actividad.preguntas.2.enunciado» → nota). Vacío si no se ha rellenado con IA. */
export const DudasContext = createContext<ReadonlyMap<string, string>>(new Map());

export function useDuda(ruta: Ruta): string | undefined {
  return useContext(DudasContext).get(claveDeRuta(ruta));
}
