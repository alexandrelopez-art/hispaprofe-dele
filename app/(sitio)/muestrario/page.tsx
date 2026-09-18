import type { ReactNode } from "react";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { Boton } from "@/components/ui/boton";
import { Enlace } from "@/components/ui/enlace";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Aviso } from "@/components/ui/aviso";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Campo } from "@/components/ui/campo";
import { Casilla } from "@/components/ui/casilla";
import { Desplegable } from "@/components/ui/desplegable";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { BloqueVacio } from "@/components/ui/bloque-vacio";

function Pieza({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <section id={`pieza-${nombre}`} className="flex flex-col gap-3">
      <h2 className="font-mono text-sm text-tinta-suave">{nombre}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

/** Las diez piezas del kit, juntas, para revisarlas de un vistazo. Solo el
 *  profesor, y fuera de cualquier menu. */
export default async function Muestrario() {
  await exigirProfesor();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-4 sm:p-6">
      <EncabezadoPagina titulo="Muestrario" subtitulo="Las piezas del sitio, con sus variantes." />
      <Pieza nombre="Boton">
        <Boton>Principal</Boton>
        <Boton variante="secundario">Secundario</Boton>
        <Boton variante="peligro">Peligro</Boton>
        <Boton enviando textoEnviando="Guardando…">Guardar</Boton>
        <Boton disabled>Apagado</Boton>
      </Pieza>
      <Pieza nombre="Enlace">
        <Enlace href="/muestrario">Un enlace</Enlace>
        <Enlace href="/muestrario" comoBoton="principal">
          Empezar
        </Enlace>
        <Enlace href="/muestrario" comoBoton="secundario">
          Ver resultado
        </Enlace>
      </Pieza>
      <Pieza nombre="Tarjeta">
        <Tarjeta>Una tarjeta con su sombra y su radio.</Tarjeta>
      </Pieza>
      <Pieza nombre="Aviso">
        <Aviso tono="info" titulo="Información">Algo que conviene saber.</Aviso>
        <Aviso tono="exito" titulo="Hecho">Se ha guardado.</Aviso>
        <Aviso tono="aviso" titulo="Aviso">Se pasó el plazo.</Aviso>
        <Aviso tono="error" titulo="Error">No se ha podido guardar.</Aviso>
      </Pieza>
      <Pieza nombre="EtiquetaEstado">
        <EtiquetaEstado tono="neutro">Sin empezar</EtiquetaEstado>
        <EtiquetaEstado tono="info">A medias</EtiquetaEstado>
        <EtiquetaEstado tono="exito">Entregada</EtiquetaEstado>
        <EtiquetaEstado tono="aviso">Se pasó el plazo</EtiquetaEstado>
        <EtiquetaEstado tono="error">Error</EtiquetaEstado>
      </Pieza>
      <Pieza nombre="Campo">
        <Campo id="m-nombre" etiqueta="Nombre" ayuda="Como quieres que te llamen." />
        <Campo id="m-correo" etiqueta="Correo" error="Falta la arroba." defaultValue="ana.ejemplo.com" />
        <Campo id="m-texto" etiqueta="Comentario" multilinea rows={3} />
      </Pieza>
      <Pieza nombre="Casilla">
        <Casilla id="m-casilla" etiqueta="Marcar todos" />
      </Pieza>
      <Pieza nombre="Desplegable">
        <Desplegable
          id="m-modo"
          etiqueta="Modo"
          opciones={[
            { valor: "COMPLETO", texto: "Completo" },
            { valor: "LIBRE", texto: "Práctica libre" },
          ]}
        />
      </Pieza>
      <Pieza nombre="EncabezadoPagina">
        <EncabezadoPagina titulo="Exámenes" subtitulo="Los que has cargado" acciones={<Boton>Nuevo examen</Boton>} />
      </Pieza>
      <Pieza nombre="BloqueVacio">
        <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando el profesor te asigne un examen, aparecerá aquí." />
      </Pieza>
    </main>
  );
}
