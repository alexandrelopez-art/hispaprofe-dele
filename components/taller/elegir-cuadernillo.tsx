"use client";

import { useState } from "react";
import { elegirCuadernilloAccion } from "@/app/(sitio)/examenes/acciones";
import { Boton } from "@/components/ui/boton";
import { Desplegable } from "@/components/ui/desplegable";
import { examenesDelCuadernillo } from "@/lib/taller/cuadernillo-elegido";

type Cuadernillo = { id: string; titulo: string; examenes: string[] };

export function ElegirCuadernillo({
  examenId,
  cuadernillos,
  elegidoId,
  numero,
}: {
  examenId: string;
  cuadernillos: Cuadernillo[];
  elegidoId: string | null;
  numero: number | null;
}) {
  const [cuadernilloId, setCuadernilloId] = useState(elegidoId ?? "");
  const [numeroElegido, setNumeroElegido] = useState(numero === null ? "" : String(numero));
  const examenes = examenesDelCuadernillo(cuadernillos, cuadernilloId);

  return (
    <form action={elegirCuadernilloAccion.bind(null, examenId)} className="flex flex-wrap items-end gap-3">
      <Desplegable
        id="cuadernilloId"
        name="cuadernilloId"
        etiqueta="Cuadernillo"
        value={cuadernilloId}
        onChange={(e) => {
          // Cambiar de libro no puede dejar puesto un número que era de
          // otro: si el nuevo también tiene ese número, se aceptaría en
          // silencio y quedaría emparejado con las respuestas equivocadas.
          setCuadernilloId(e.target.value);
          setNumeroElegido("");
        }}
        opciones={[{ valor: "", texto: "Ninguno" }, ...cuadernillos.map((c) => ({ valor: c.id, texto: c.titulo }))]}
      />
      <Desplegable
        id="numero"
        name="numero"
        etiqueta="Qué examen del libro es"
        value={numeroElegido}
        onChange={(e) => setNumeroElegido(e.target.value)}
        opciones={[{ valor: "", texto: "Sin elegir" }, ...examenes.map((e) => ({ valor: e, texto: `Examen ${e}` }))]}
      />
      <Boton type="submit">Guardar</Boton>
    </form>
  );
}
