"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sustituirPaginasAccion } from "@/app/(sitio)/examenes/acciones";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import { paginasDePdf } from "@/lib/taller/pdf-en-navegador";
import { idsEnOrden, type EstadoDePagina } from "@/lib/taller/lista-de-subida";

const NOMBRE_DEL_ESTADO: Record<EstadoDePagina["estado"], string> = {
  PENDIENTE: "En espera",
  SUBIENDO: "Subiendo…",
  SUBIDA: "Subida",
  FALLIDA: "Falló",
};

const AVISO_DE_FALLO_AL_REGISTRAR = "No se ha podido registrar las páginas. Pulsa «Registrar de nuevo».";

export function SubirPaginas({ examenId, hayPaginas }: { examenId: string; hayPaginas: boolean }) {
  const router = useRouter();
  const ficheros = useRef<File[]>([]);
  const lista = useRef<EstadoDePagina[]>([]);
  const [paginas, setPaginas] = useState<EstadoDePagina[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Verdadero cuando el último intento de sustituirPaginasAccion falló (con
  // error o lanzando): mientras lo sea y ya haya páginas subidas, se ofrece
  // «Registrar de nuevo» en vez de dejar el examen sin páginas y sin salida.
  const [registroFallido, setRegistroFallido] = useState(false);
  const pintar = () => setPaginas([...lista.current]);

  async function subirUna(i: number) {
    lista.current[i] = { ...lista.current[i], estado: "SUBIENDO", error: null };
    pintar();
    try {
      const id = await subirAlAlmacen(ficheros.current[i]);
      lista.current[i] = { ...lista.current[i], estado: "SUBIDA", ficheroId: id };
    } catch (e) {
      lista.current[i] = { ...lista.current[i], estado: "FALLIDA", error: e instanceof Error ? e.message : "Fallo desconocido." };
    }
    pintar();
  }

  async function registrarSiEstanTodas() {
    const ids = idsEnOrden(lista.current);
    if (!ids) {
      setAviso("Hay páginas sin subir: pulsa «Reintentar» en las marcadas.");
      return;
    }
    try {
      const r = await sustituirPaginasAccion(examenId, ids);
      if (r.error) {
        // La lista se deja tal cual: todo sigue "SUBIDA" y sus ficheros
        // siguen en el almacén, así que "Registrar de nuevo" puede repetir
        // el envío sin volver a subir nada.
        setAviso(r.error);
        setRegistroFallido(true);
        return;
      }
      lista.current = [];
      ficheros.current = [];
      pintar();
      setAviso(null);
      setRegistroFallido(false);
      router.refresh();
    } catch {
      setAviso(AVISO_DE_FALLO_AL_REGISTRAR);
      setRegistroFallido(true);
    }
  }

  async function alElegir(fichero: File | undefined) {
    if (!fichero) return;
    setOcupado(true);
    setAviso("Partiendo el PDF en páginas…");
    setRegistroFallido(false);
    try {
      ficheros.current = await paginasDePdf(fichero);
      lista.current = ficheros.current.map((f) => ({ nombre: f.name, estado: "PENDIENTE", ficheroId: null, error: null }));
      pintar();
      setAviso(null);
      for (let i = 0; i < ficheros.current.length; i++) await subirUna(i);
      await registrarSiEstanTodas();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido leer el PDF.");
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  async function reintentar(i: number) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await subirUna(i);
      await registrarSiEstanTodas();
    } catch {
      setAviso("No se ha podido reintentar la subida. Vuelve a intentarlo.");
    } finally {
      setOcupado(false);
    }
  }

  async function registrarDeNuevo() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await registrarSiEstanTodas();
    } catch {
      setAviso(AVISO_DE_FALLO_AL_REGISTRAR);
      setRegistroFallido(true);
    } finally {
      setOcupado(false);
    }
  }

  const puedeElegir = !hayPaginas || confirmando;
  const puedeRegistrarDeNuevo = registroFallido && idsEnOrden(paginas) !== null;

  return (
    <div className="flex flex-col gap-3">
      {hayPaginas && !confirmando && (
        <button type="button" onClick={() => setConfirmando(true)} className="self-start rounded-2xl border border-tinta-suave/30 px-4 py-2">
          Sustituir las páginas
        </button>
      )}
      {hayPaginas && confirmando && (
        <p className="rounded-2xl bg-sol-100 p-4">
          Cuando el PDF nuevo termine de subir se sustituyen las páginas de ahora <strong>y sus etiquetas</strong>. Las tareas guardadas no se tocan.
        </p>
      )}
      {puedeElegir && (
        <label className="flex flex-col gap-2">
          <span className="font-bold">PDF del examen</span>
          <input
            type="file"
            accept="application/pdf"
            disabled={ocupado}
            onChange={(e) => {
              const fichero = e.target.files?.[0];
              e.target.value = "";
              void alElegir(fichero);
            }}
            className="rounded-2xl border border-tinta-suave/30 bg-white p-4"
          />
        </label>
      )}
      {aviso && <p role="status" className="rounded-2xl bg-hp-50 p-4">{aviso}</p>}
      {puedeRegistrarDeNuevo && (
        <button type="button" disabled={ocupado} onClick={() => void registrarDeNuevo()} className="self-start rounded-2xl border border-tinta-suave/30 px-4 py-2">
          Registrar de nuevo
        </button>
      )}
      {paginas.length > 0 && (
        <ol className="flex flex-col gap-1">
          {paginas.map((p, i) => (
            <li key={p.nombre} className="flex flex-wrap items-center gap-3">
              <span className="w-40 truncate">{p.nombre}</span>
              <span className={p.estado === "FALLIDA" ? "text-error-600" : "text-tinta-suave"}>
                {NOMBRE_DEL_ESTADO[p.estado]}{p.error ? `: ${p.error}` : ""}
              </span>
              {p.estado === "FALLIDA" && (
                <button type="button" disabled={ocupado} onClick={() => void reintentar(i)} className="rounded-xl border border-tinta-suave/30 px-3 py-1">
                  Reintentar
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
