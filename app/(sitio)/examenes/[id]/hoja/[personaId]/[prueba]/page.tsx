import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba, NOMBRE_CORTO } from "@/lib/dele/estructura";
import { hojaDeRespuestas } from "@/lib/examen/hoja";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Enlace } from "@/components/ui/enlace";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * La ficha del profesor: qué marcó esta persona en cada pregunta y qué era.
 * Saca la `Clave` de su sitio —la respuesta correcta del examen—, así que
 * `exigirProfesor` es la puerta entera: `hojaDeRespuestas` no comprueba
 * papeles, y sin esto un estudiante que adivine la dirección de un compañero
 * vería el examen entero resuelto.
 */
export default async function Hoja({
  params,
}: {
  params: Promise<{ id: string; personaId: string; prueba: string }>;
}) {
  await exigirProfesor();
  const { id, personaId, prueba } = await params;
  if (!esPrueba(prueba)) notFound();
  const hoja = await hojaDeRespuestas(id, personaId, prueba);
  if (!hoja) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <nav>
        <Enlace href={`/examenes/${id}`}>← {hoja.titulo}</Enlace>
      </nav>
      <EncabezadoPagina
        titulo={`${hoja.persona.nombre} — ${NOMBRE_CORTO[hoja.prueba]}`}
        subtitulo={`${hoja.aciertos ?? "—"} de ${hoja.total ?? "—"} aciertos`}
      />

      <Tarjeta className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left">
              <th className="pr-4">Nº</th>
              <th className="pr-4">Marcó</th>
              <th className="pr-4">Era</th>
              <th>¿Falló?</th>
            </tr>
          </thead>
          <tbody>
            {hoja.filas.map((f) => (
              <tr key={f.numero} className={f.marcada !== f.correcta ? "bg-coral-100" : ""}>
                <td className="pr-4">{f.numero}</td>
                <td className="pr-4">{f.marcada === null ? <em>sin contestar</em> : f.marcada}</td>
                <td className="pr-4">{f.correcta}</td>
                <td>{f.marcada !== f.correcta ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </main>
  );
}
