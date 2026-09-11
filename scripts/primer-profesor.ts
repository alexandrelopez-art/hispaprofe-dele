/**
 * Crea o actualiza a una persona como PROFESOR.
 *
 * Sin esto no hay forma de dar de alta a nadie más: la pantalla de personas
 * exige ser profesor (exigirProfesor, en lib/puerta/sesion-http.ts) y la
 * base empieza vacía. Este script es la única puerta para el primer
 * profesor; después, esa persona da de alta a las demás desde /personas.
 *
 * Uso:
 *   npx tsx scripts/primer-profesor.ts <correo> <nombre>
 *
 * Ejemplo:
 *   npx tsx scripts/primer-profesor.ts pablo@hispaprofe.com "Pablo"
 *
 * Si el correo ya existe, se actualiza su papel a PROFESOR (y se reactiva si
 * estaba dado de baja); si no existe, se crea.
 */
import "dotenv/config";

function uso(): never {
  console.error("Uso: npx tsx scripts/primer-profesor.ts <correo> <nombre>");
  console.error('Ejemplo: npx tsx scripts/primer-profesor.ts pablo@hispaprofe.com "Pablo"');
  process.exit(1);
}

async function main(): Promise<void> {
  const [, , correoCrudo, ...restoDelNombre] = process.argv;
  const nombre = restoDelNombre.join(" ").trim();
  if (!correoCrudo || !nombre) uso();

  // Comprobación propia, ANTES de importar @/lib/db: ese módulo revienta al
  // importarse si falta DATABASE_URL (ver lib/db.ts), con un mensaje pensado
  // para el servidor de Next, no para quien corre un script a mano. Esta es
  // la que de verdad hace falta aquí.
  if (!process.env.DATABASE_URL) {
    console.error(
      "Falta la variable de entorno DATABASE_URL. Copia .env.example a .env y " +
        "rellénala (mira el README) antes de correr este script.",
    );
    process.exit(1);
  }

  const { prisma } = await import("@/lib/db");
  const { normalizarCorreo } = await import("@/lib/puerta/entrada");

  const correo = normalizarCorreo(correoCrudo);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    console.error(`Eso no parece una dirección de correo: "${correoCrudo}".`);
    process.exit(1);
  }

  const persona = await prisma.persona.upsert({
    where: { correo },
    update: { nombre, papel: "PROFESOR", activa: true },
    create: { correo, nombre, papel: "PROFESOR" },
  });

  console.log(`Profesor listo: ${persona.nombre} <${persona.correo}> (id ${persona.id}).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("No se pudo crear o actualizar el profesor.", error);
  process.exitCode = 1;
});
