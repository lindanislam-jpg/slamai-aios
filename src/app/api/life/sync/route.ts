import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { badRequest, readJson, requireUser } from "@/lib/api";
import type { LifeState } from "@/lib/life/types";
import type { SyncPayload } from "@/lib/life/sync";

/**
 * The sync endpoint for Elite Life OS.
 *
 * The browser stays the source of truth while you are using it; this stores one
 * JSON document per account so another device can pick the day up. Signed out,
 * /life never calls this and works exactly as before, on-device only.
 */

/** A generous ceiling for years of daily logs, and a cheap shield against abuse. */
const MAX_BYTES = 4_000_000;

function looksLikeState(value: unknown): value is LifeState {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<LifeState>;
  return (
    typeof s.version === "number" &&
    typeof s.days === "object" &&
    s.days !== null &&
    typeof s.settings === "object" &&
    s.settings !== null
  );
}

/** Reads this account's stored copy. `data: null` means nothing synced yet. */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const row = await db.lifeSnapshot.findUnique({ where: { userId: gate.userId } });
  const body: SyncPayload = row
    ? { data: row.data as unknown as LifeState, revision: row.revision, updatedAt: row.updatedAt.toISOString() }
    : { data: null, revision: 0, updatedAt: null };

  return NextResponse.json(body);
}

/**
 * Stores a new copy.
 *
 * `baseRevision` is the revision the client merged from. If the server has
 * moved on since — another device pushed in the meantime — nothing is written
 * and the current copy comes back with a 409 for the client to merge and retry.
 * This is what stops a stale tab from flattening a day logged elsewhere.
 */
export async function PUT(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<{ data?: unknown; baseRevision?: unknown }>(req);
  if (!body || !looksLikeState(body.data)) return badRequest("Expected a Life OS state document.");
  if (typeof body.baseRevision !== "number") return badRequest("Expected the revision this push was based on.");

  const data = body.data;
  if (JSON.stringify(data).length > MAX_BYTES) {
    return badRequest("That backup is too large to sync. Export it instead.");
  }

  const current = await db.lifeSnapshot.findUnique({
    where: { userId: gate.userId },
    select: { revision: true },
  });

  if (current && current.revision !== body.baseRevision) {
    const row = await db.lifeSnapshot.findUnique({ where: { userId: gate.userId } });
    const conflict: SyncPayload = {
      data: (row?.data ?? null) as unknown as LifeState | null,
      revision: row?.revision ?? 0,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
    return NextResponse.json(conflict, { status: 409 });
  }

  const json = data as unknown as Prisma.InputJsonValue;
  const revision = (current?.revision ?? 0) + 1;
  const saved = await db.lifeSnapshot.upsert({
    where: { userId: gate.userId },
    create: { userId: gate.userId, data: json, revision },
    update: { data: json, revision },
  });

  const ok: SyncPayload = {
    data: null, // the client already has what it just sent
    revision: saved.revision,
    updatedAt: saved.updatedAt.toISOString(),
  };
  return NextResponse.json(ok);
}

/** Removes the synced copy. The device keeps its own; only the server forgets. */
export async function DELETE() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  await db.lifeSnapshot.deleteMany({ where: { userId: gate.userId } });
  return NextResponse.json({ ok: true });
}
