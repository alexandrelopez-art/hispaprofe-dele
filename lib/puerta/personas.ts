import { prisma } from "@/lib/db";
import type { Papel, Persona } from "@/lib/generated/prisma";
import { normalizarCorreo } from "@/lib/puerta/entrada";

export type Alta = { correo: string; nombre: string; papel: Papel };

export async function darDeAlta(
  quien: Persona,
  datos: Alta,
): Promise<{ persona: Persona } | { error: string }> {
  if (quien.papel !== "PROFESOR") {
    return { error: "Solo el profesor puede dar de alta a alguien." };
  }
  const correo = normalizarCorreo(datos.correo);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { error: "Eso no parece una dirección de correo." };
  }
  if (await prisma.persona.findUnique({ where: { correo } })) {
    return { error: "Ese correo ya está dado de alta." };
  }
  const persona = await prisma.persona.create({
    data: { correo, nombre: datos.nombre.trim(), papel: datos.papel },
  });
  return { persona };
}

/** Lo único que la pantalla necesita enseñar. Ni activa ni createdAt salen de aquí. */
export type PersonaListada = Pick<Persona, "id" | "nombre" | "correo" | "papel">;

export function listarPersonas(): Promise<PersonaListada[]> {
  return prisma.persona.findMany({
    select: { id: true, nombre: true, correo: true, papel: true },
    orderBy: [{ papel: "asc" }, { nombre: "asc" }],
  });
}
