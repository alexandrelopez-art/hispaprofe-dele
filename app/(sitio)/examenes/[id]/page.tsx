import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, PRUEBAS, etiquetasDeNivel, nombreCortoDeTarea, nombreDeEtiqueta } from "@/lib/dele/estructura";
import { examenParaElTaller } from "@/lib/taller/examenes";
import { textoDelGasto } from "@/lib/taller/ia/coste";
import { listarCuadernillos } from "@/lib/taller/cuadernillos";
import { asignacionesDelExamen, estudiantesParaAsignar } from "@/lib/examen/asignar";
import { cerrarLasQueSePasaron } from "@/lib/examen/hacer";
import {
  archivarExamenAccion,
  publicarExamenAccion,
  recuperarExamenAccion,
  retirarExamenAccion,
} from "@/app/(sitio)/examenes/acciones";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
import { ElegirCuadernillo } from "@/components/taller/elegir-cuadernillo";
import { EtiquetarAutomaticamente } from "@/components/taller/etiquetar-automaticamente";
import { EtiquetasDePagina } from "@/components/taller/etiquetas-de-pagina";
import { InsigniaDeEstado } from "@/components/taller/estado-de-la-tarea";
import { QuienLoHace } from "@/components/taller/quien-lo-hace";
import { SubirCuadernillo } from "@/components/taller/subir-cuadernillo";
import { SubirPaginas } from "@/components/taller/subir-paginas";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Enlace } from "@/components/ui/enlace";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Tarjeta } from "@/components/ui/tarjeta";

// El lector OCR de un examen entero (una hoja por página) tarda unos 20 s,
// igual de por encima del límite por defecto que "Rellenar con IA" en la
// pantalla de la tarea.
export const maxDuration = 300;

export default async function PantallaDelExamen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; aviso?: string }>;
}) {
  await exigirProfesor();
  const [{ id }, { error, aviso }] = await Promise.all([params, searchParams]);
  const examen = await examenParaElTaller(id);
  if (!examen) notFound();
  const cuadernillos = await listarCuadernillos();
  const todas = etiquetasDeNivel(examen.nivel);
  const sinEtiqueta = examen.paginas.filter((p) => p.etiquetas.length === 0).length;
  const algunaEtiquetada = examen.paginas.some((p) => p.etiquetas.length > 0);
  const elegido = examen.cuadernillo;
  const resumenDelNumero = elegido?.resumen.find((r) => r.examen === String(examen.numeroEnCuadernillo));
  const publicado = examen.estado === "PUBLICADO";
  const archivado = examen.estado === "ARCHIVADO";
  // Una sola noción de editable para toda la pantalla: publicado y archivado se
  // pintan distinto (Retirar / Recuperar) pero ninguno de los dos deja tocar
  // cuadernillo, páginas ni etiquetas. Antes esto se decidía tres veces con
  // `!publicado`, y un examen archivado (publicado === false) se colaba como
  // editable.
  const editable = examen.estado === "EN_CONSTRUCCION";
  const motivos = examen.motivosParaPublicar;
  // Solo se piden si hace falta: en construcción o archivado serían dos
  // consultas de más en cada visita al taller.
  if (publicado) {
    // Antes de leer quién lo hace: si no, quien cerró el portátil a medio
    // examen se vería "a medias" para siempre y sin nota en esta lista.
    await cerrarLasQueSePasaron({ examenId: id }, new Date());
  }
  const [estudiantes, asignaciones] = publicado
    ? await Promise.all([estudiantesParaAsignar(), asignacionesDelExamen(id)])
    : [[], []];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <Enlace href="/examenes" className="self-start">← Exámenes</Enlace>
      <EncabezadoPagina
        titulo={examen.titulo}
        subtitulo={[NOMBRE_DE_NIVEL[examen.nivel], textoDelGasto(examen.gasto)].filter(Boolean).join(" · ")}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      {aviso && (
        <div role="status">
          <Aviso tono="exito">{aviso}</Aviso>
        </div>
      )}

      {/* Dos columnas en pantalla ancha: a la izquierda lo que se construye
          (tareas, cuadernillo, páginas); a la derecha lo que se hace con el
          examen (publicarlo y asignarlo). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta as="section" className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-bold">Tareas</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {PRUEBAS.map((prueba) => (
                <div key={prueba} className="flex min-w-0 flex-col gap-2">
                  <h3 className="font-bold capitalize">{NOMBRE_DE_PRUEBA[prueba]}</h3>
                  {examen.tareas.filter((t) => t.prueba === prueba).map((t) => (
                    <Link
                      key={t.numero}
                      href={`/examenes/${examen.id}/${t.prueba}/${t.numero}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-tinta-suave/20 p-3 hover:bg-hp-50 focus-visible:outline-2 focus-visible:outline-hp-600"
                    >
                      <span className="font-bold">{nombreCortoDeTarea(t.prueba, t.numero)}</span>
                      <span className="flex items-center gap-2">
                        {t.estado.estado === "A_MEDIAS" && <span className="text-sm text-tinta-suave">{t.estado.motivos.length} por resolver</span>}
                        <InsigniaDeEstado estado={t.estado.estado} />
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta as="section" className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-bold">Cuadernillo de soluciones</h2>
            {editable && (
              <ElegirCuadernillo
                key={`${examen.cuadernillo?.id ?? ""}-${examen.numeroEnCuadernillo ?? ""}`}
                examenId={examen.id}
                cuadernillos={cuadernillos}
                elegidoId={elegido?.id ?? null}
                numero={examen.numeroEnCuadernillo}
              />
            )}

            {elegido && (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <caption className="pb-2 text-left font-bold">Lo que el taller ha entendido de «{elegido.titulo}»</caption>
                  <thead>
                    <tr className="text-left">
                      <th className="pr-4">Examen</th>
                      <th className="pr-4">Lectura (6, 6, 6, 7)</th>
                      <th className="pr-4">Auditiva (7, 6, 6, 6)</th>
                      <th>¿Cuadra?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elegido.resumen.map((r) => (
                      <tr key={r.examen} className={r === resumenDelNumero ? "bg-hp-50 font-bold" : ""}>
                        <td className="pr-4">{r.examen}</td>
                        {r.pruebas.map((p) => (
                          <td key={p.prueba} className="pr-4">
                            {p.filas.map((f) => f.encontradas).join(", ")}
                            {p.fuera.length > 0 ? ` · sobran ${p.fuera.join(", ")}` : ""}
                          </td>
                        ))}
                        <td className={r.bien ? "text-verde-600" : "text-coral-600"}>{r.bien ? "Sí" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {editable && (
              <details>
                <summary className="cursor-pointer font-bold">Subir un cuadernillo nuevo</summary>
                <div className="pt-3"><SubirCuadernillo examenId={examen.id} /></div>
              </details>
            )}
          </Tarjeta>

          <Tarjeta as="section" className="flex min-w-0 flex-col gap-4">
            <h2 className="text-xl font-bold">Páginas</h2>
            {editable && examen.paginas.length > 0 && (
              <EtiquetarAutomaticamente examenId={examen.id} algunaEtiquetada={algunaEtiquetada} />
            )}
            {examen.paginas.length > 0 && sinEtiqueta > 0 && (
              <Aviso tono="aviso">{sinEtiqueta === 1 ? "Hay 1 hoja sin etiquetar." : `Hay ${sinEtiqueta} hojas sin etiquetar.`}</Aviso>
            )}
            {examen.paginas.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {examen.paginas.map((p) =>
                  !editable ? (
                    <figure key={p.id} className="flex min-w-0 flex-col gap-2 rounded-tarjeta border border-tinta-suave/20 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos */}
                      <img src={`/api/ficheros/${p.ficheroId}`} alt={`Hoja ${p.orden}`} loading="lazy" className="w-full rounded-xl border border-tinta-suave/10" />
                      <figcaption className="font-bold">Hoja {p.orden} · {p.etiquetas.map(nombreDeEtiqueta).join(", ") || "sin etiquetar"}</figcaption>
                    </figure>
                  ) : (
                    // La clave lleva las etiquetas: el etiquetado automático cambia
                    // `p.etiquetas` desde fuera de esta tarjeta (no con su propio
                    // botón), y sin esto React reutilizaría la instancia con su
                    // estado local (`marcadas`) desactualizado en vez de arrancar
                    // de las etiquetas nuevas que ya trae el examen.
                    <EtiquetasDePagina key={`${p.id}:${p.etiquetas.join(",")}`} examenId={examen.id} pagina={p} todas={todas} />
                  ),
                )}
              </div>
            )}
            {editable && <SubirPaginas examenId={examen.id} hayPaginas={examen.paginas.length > 0} />}
          </Tarjeta>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* La Tarjeta no pasa atributos: el data-publicacion va en el div de dentro. */}
          <Tarjeta as="section">
            <div className="flex min-w-0 flex-col gap-4" data-publicacion>
              <h2 className="text-xl font-bold">Publicación</h2>
              {publicado ? (
                <>
                  <EtiquetaEstado tono="exito">Publicado</EtiquetaEstado>
                  <p className="text-tinta-suave">{MENSAJE_PUBLICADO}</p>
                  <form action={retirarExamenAccion.bind(null, examen.id)}>
                    <Boton type="submit" variante="secundario">Retirar</Boton>
                  </form>
                </>
              ) : archivado ? (
                <>
                  <EtiquetaEstado tono="neutro">Archivado</EtiquetaEstado>
                  <p className="text-tinta-suave">Fuera de circulación.</p>
                  <form action={recuperarExamenAccion.bind(null, examen.id)}>
                    <Boton type="submit" variante="secundario">Recuperar</Boton>
                  </form>
                </>
              ) : (
                <>
                  <form action={publicarExamenAccion.bind(null, examen.id)}>
                    <Boton type="submit" disabled={motivos.length > 0}>Publicar</Boton>
                  </form>
                  {motivos.length > 0 && (
                    <Aviso tono="aviso" titulo="Todavía no se puede publicar">
                      <ul className="list-disc pl-5">
                        {motivos.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </Aviso>
                  )}
                  <form action={archivarExamenAccion.bind(null, examen.id)}>
                    <Boton type="submit" variante="peligro">Archivar</Boton>
                  </form>
                </>
              )}
            </div>
          </Tarjeta>

          <Tarjeta as="section">
            <div className="flex min-w-0 flex-col gap-4" data-asignacion>
              <h2 className="text-xl font-bold">Quién lo hace</h2>
              {publicado ? (
                <QuienLoHace examenId={examen.id} estudiantes={estudiantes} asignaciones={asignaciones} />
              ) : (
                <p className="text-tinta-suave">Publícalo primero: un examen en construcción todavía no se asigna.</p>
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </main>
  );
}
