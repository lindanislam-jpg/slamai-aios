import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "./auth";
import { isOpenAIConfigured } from "./openai";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** Resolve the signed-in user's id, or null when there is no session. */
export async function requireUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Parse and validate a JSON body. Returns a 400 response instead of throwing
 * when the body is malformed or fails the schema.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { data: null, error: badRequest("Invalid JSON body") };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { data: null, error: badRequest(result.error.issues[0]?.message || "Invalid request body") };
  }
  return { data: result.data, error: null };
}

/** Guard AI routes so a missing key is a clear 503 rather than a crash. */
export function openAIUnavailable() {
  if (isOpenAIConfigured()) return null;
  return NextResponse.json(
    { error: "AI features are not configured. Set OPENAI_API_KEY to enable them." },
    { status: 503 }
  );
}

/** Turn an upstream/model failure into a 502 without leaking internals. */
export function aiError(err: unknown, context: string) {
  console.error(`[${context}]`, err);
  return NextResponse.json(
    { error: "The AI service failed to respond. Please try again." },
    { status: 502 }
  );
}
