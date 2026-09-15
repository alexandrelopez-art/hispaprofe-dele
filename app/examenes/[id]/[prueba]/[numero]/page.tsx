import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba, nombreCortoDeTarea } from "@/lib/dele/estructura";
import { tareaParaElTaller } from "@/lib/taller/examenes";
import { hayClaveDeIA } from "@/lib/taller/ia/llamar";
import { FormularioDeTarea } from "@/components/taller/formulario-de-tarea";

// Rellenar con IA puede tardar: una tarea con varias hojas y razonamiento, en torno al minuto.
export const maxDuration = 300;

export default async function PantallaDeTarea({ params }: { params: Promise<{ id: string; prueba: string; numero: string }> }) {
  await exigirProfesor();
  const { id, prueba, numero } = await params;
  const n = Number(numero);
  if (!esPrueba(prueba) || !Number.isInteger(n)) notFound();
  const tarea = await tareaParaElTaller(id, prueba, n);
  if (!tarea) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
      <nav><Link href={`/examenes/${id}`} className="text-hp-600 underline">← {tarea.examen.titulo}</Link></nav>
      <h1 className="text-2xl font-bold">{nombreCortoDeTarea(prueba, n)}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna con scroll propio y alto de ventana: una columna sticky más alta que la ventana no deja ver su final. */}
        <section className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          {tarea.paginas.length === 0 ? (
            <p className="rounded-2xl bg-sol-100 p-4">Ninguna hoja lleva esta tarea. Etiquétala en la pantalla del examen.</p>
          ) : (
            tarea.paginas.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos
              <img key={p.ficheroId} src={`/api/ficheros/${p.ficheroId}`} alt={`Hoja ${p.orden}`} className="w-full rounded-2xl border border-tinta-suave/20" />
            ))
          )}
        </section>
        <FormularioDeTarea
          examenId={id}
          prueba={prueba}
          numero={n}
          regla={tarea.regla}
          inicial={tarea.formulario}
          respuestas={tarea.respuestas}
          temasDeLaHermana={tarea.temasDeLaHermana}
          estadoInicial={tarea.estado}
          hayClave={hayClaveDeIA()}
          hayHojas={tarea.paginas.length > 0}
          publicado={tarea.publicado}
        />
      </div>
    </main>
  );
}
