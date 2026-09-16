import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, PRUEBAS, etiquetasDeNivel, nombreCortoDeTarea, nombreDeEtiqueta } from "@/lib/dele/estructura";
import { examenParaElTaller } from "@/lib/taller/examenes";
import { textoDelGasto } from "@/lib/taller/ia/coste";
import { listarCuadernillos } from "@/lib/taller/cuadernillos";
import { asignacionesDelExamen, estudiantesParaAsignar } from "@/lib/examen/asignar";
import {
  archivarExamenAccion,
  publicarExamenAccion,
  recuperarExamenAccion,
  retirarExamenAccion,
} from "@/app/examenes/acciones";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
import { ElegirCuadernillo } from "@/components/taller/elegir-cuadernillo";
import { EtiquetasDePagina } from "@/components/taller/etiquetas-de-pagina";
import { InsigniaDeEstado } from "@/components/taller/estado-de-la-tarea";
import { QuienLoHace } from "@/components/taller/quien-lo-hace";
import { SubirCuadernillo } from "@/components/taller/subir-cuadernillo";
import { SubirPaginas } from "@/components/taller/subir-paginas";

const CAJA = "flex min-w-0 flex-col gap-4 rounded-2xl border border-tinta-suave/20 bg-white p-5";

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
  const elegido = examen.cuadernillo;
  const resumenDelNumero = elegido?.resumen.find((r) => r.examen === String(examen.numeroEnCuadernillo));
  const publicado = examen.estado === "PUBLICADO";
  const archivado = examen.estado === "ARCHIVADO";
  const motivos = examen.motivosParaPublicar;
  // Solo se piden si hace falta: en construcción o archivado serían dos
  // consultas de más en cada visita al taller.
  const [estudiantes, asignaciones] = publicado
    ? await Promise.all([estudiantesParaAsignar(), asignacionesDelExamen(id)])
    : [[], []];

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6">
      <nav><Link href="/examenes" className="text-hp-600 underline">← Exámenes</Link></nav>
      <header>
        <h1 className="text-2xl font-bold">{examen.titulo}</h1>
        <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[examen.nivel]}</p>
        {textoDelGasto(examen.gasto) && <p className="text-sm text-tinta-suave">{textoDelGasto(examen.gasto)}</p>}
      </header>
      {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
      {aviso && <p role="status" className="rounded-2xl bg-verde-100 p-4 text-verde-600">{aviso}</p>}

      <section className={CAJA} data-publicacion>
        <h2 className="text-xl font-bold">Publicación</h2>
        {publicado ? (
          <>
            <p className="font-bold text-verde-600">Publicado</p>
            <p className="text-tinta-suave">{MENSAJE_PUBLICADO}</p>
            <form action={retirarExamenAccion.bind(null, examen.id)}>
              <button type="submit" className="rounded-2xl border border-hp-400 px-5 py-2 font-bold text-hp-600">Retirar</button>
            </form>
          </>
        ) : archivado ? (
          <>
            <p className="font-bold text-tinta-suave">Archivado: fuera de circulación.</p>
            <form action={recuperarExamenAccion.bind(null, examen.id)}>
              <button type="submit" className="rounded-2xl border border-hp-400 px-5 py-2 font-bold text-hp-600">Recuperar</button>
            </form>
          </>
        ) : (
          <>
            <form action={publicarExamenAccion.bind(null, examen.id)}>
              <button type="submit" disabled={motivos.length > 0} className={`rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white ${motivos.length > 0 ? "opacity-50" : ""}`}>Publicar</button>
            </form>
            {motivos.length > 0 && (
              <ul className="list-disc pl-5">
                {motivos.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
            <form action={archivarExamenAccion.bind(null, examen.id)}>
              <button type="submit" className="rounded-2xl border border-tinta-suave/30 px-5 py-2 font-bold text-tinta-suave">Archivar</button>
            </form>
          </>
        )}
      </section>

      {publicado && (
        <section className={CAJA} data-asignacion>
          <h2 className="text-xl font-bold">Quién lo hace</h2>
          <QuienLoHace examenId={examen.id} estudiantes={estudiantes} asignaciones={asignaciones} />
        </section>
      )}

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Tareas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {PRUEBAS.map((prueba) => (
            <div key={prueba} className="flex min-w-0 flex-col gap-2">
              <h3 className="font-bold capitalize">{NOMBRE_DE_PRUEBA[prueba]}</h3>
              {examen.tareas.filter((t) => t.prueba === prueba).map((t) => (
                <Link
                  key={t.numero}
                  href={`/examenes/${examen.id}/${t.prueba}/${t.numero}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tinta-suave/20 p-3"
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
      </section>

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Cuadernillo de soluciones</h2>
        {!publicado && (
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
                    <td className={r.bien ? "text-verde-600" : "text-error-600"}>{r.bien ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!publicado && (
          <details>
            <summary className="cursor-pointer font-bold">Subir un cuadernillo nuevo</summary>
            <div className="pt-3"><SubirCuadernillo examenId={examen.id} /></div>
          </details>
        )}
      </section>

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Páginas</h2>
        {examen.paginas.length > 0 && sinEtiqueta > 0 && (
          <p className="rounded-2xl bg-sol-100 p-4">{sinEtiqueta === 1 ? "Hay 1 hoja sin etiquetar." : `Hay ${sinEtiqueta} hojas sin etiquetar.`}</p>
        )}
        {examen.paginas.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examen.paginas.map((p) =>
              publicado ? (
                <figure key={p.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-tinta-suave/20 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos */}
                  <img src={`/api/ficheros/${p.ficheroId}`} alt={`Hoja ${p.orden}`} loading="lazy" className="w-full rounded-xl border border-tinta-suave/10" />
                  <figcaption className="font-bold">Hoja {p.orden} · {p.etiquetas.map(nombreDeEtiqueta).join(", ") || "sin etiquetar"}</figcaption>
                </figure>
              ) : (
                <EtiquetasDePagina key={p.id} examenId={examen.id} pagina={p} todas={todas} />
              ),
            )}
          </div>
        )}
        {!publicado && <SubirPaginas examenId={examen.id} hayPaginas={examen.paginas.length > 0} />}
      </section>
    </main>
  );
}
