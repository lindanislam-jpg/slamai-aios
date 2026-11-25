import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from "zod";
import { firstError } from "./validation";

/**
 * Response and request helpers shared by every SlamAI Voice API route, so
 * error shape, validation and pagination behave the same everywhere.
 * The client reads `error` from any non-2xx body.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export const badRequest = (message: string) => fail(message, 400);
export const notFound = (message = "Not found") => fail(message, 404);
export const forbidden = (message = "Not allowed") => fail(message, 403);
export const conflict = (message: string) => fail(message, 409);

/**
 * Logs the real error server-side and returns a message safe to show a user.
 * Stack traces and driver errors must never reach the browser.
 */
export function serverError(context: string, err: unknown) {
  console.error(`[api:${context}]`, err);
  return fail("Something went wrong. Please try again.", 500);
}

/** Parses and validates a JSON body in one step. */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ ok: true; data: ZodInfer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: badRequest("Send a valid JSON body.") };
  }

  try {
    return { ok: true, data: schema.parse(raw) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, response: badRequest(firstError(err)) };
    }
    return { ok: false, response: badRequest("That input isn't valid.") };
  }
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export type Pagination = { skip: number; take: number; page: number; pageSize: number };

/** Reads `page` and `pageSize` from the query string, clamped to sane bounds. */
export function pagination(req: Request): Pagination {
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE)
  );
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function paged<T>(items: T[], total: number, p: Pagination) {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    pageCount: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}

export function queryParam(req: Request, key: string): string | null {
  const value = new URL(req.url).searchParams.get(key);
  return value && value.trim() ? value.trim() : null;
}
