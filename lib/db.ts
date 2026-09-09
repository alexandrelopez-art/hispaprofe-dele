import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma";

const global_ = globalThis as unknown as { prisma?: PrismaClient };

function crearPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL. Defínela en .env " +
        "(mira .env.example) antes de usar la base de datos.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = global_.prisma ?? crearPrisma();

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
