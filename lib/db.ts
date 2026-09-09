import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma";

const global_ = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = global_.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
