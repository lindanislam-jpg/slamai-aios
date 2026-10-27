import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// On Netlify the managed database URL arrives as NETLIFY_DB_URL.
const datasourceUrl = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || undefined;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl, log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
