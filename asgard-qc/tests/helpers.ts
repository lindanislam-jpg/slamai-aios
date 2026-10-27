import type { Role } from "@prisma/client";
import sharp from "sharp";
import { db } from "@/lib/db";
import { permissionsFor, type Actor } from "@/lib/permissions";
import { hashPassword } from "@/lib/session";

let n = 0;

/** Empty every table (keeps the schema). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function makeActor(role: Role, name?: string): Promise<Actor> {
  n++;
  const u = await db.user.create({ data: { email: `t${n}-${role.toLowerCase()}@test.invalid`, name: name ?? `Test ${role} ${n}`, role, passwordHash: await hashPassword("test-password-123") } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, permissions: permissionsFor(u.role) };
}

export async function jpeg(opts: { exifDate?: string; color?: string; w?: number } = {}) {
  let img = sharp({ create: { width: opts.w ?? 320, height: 240, channels: 3, background: opts.color ?? "#336699" } }).jpeg();
  if (opts.exifDate) img = img.withExif({ IFD2: { DateTimeOriginal: opts.exifDate } });
  return img.toBuffer();
}

export const png = (color = "#994422") => sharp({ create: { width: 64, height: 64, channels: 3, background: color } }).png().toBuffer();
