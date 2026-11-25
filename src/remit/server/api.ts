import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError, type ZodSchema } from "zod";
import { AmountOutOfRangeError } from "../quotes/quote-calculator";
import { NoFeeRuleError } from "../fees/fee-engine";
import { InvalidTransferTransitionError } from "../transfers/status";
import { ProviderError, ProviderNotConfiguredError } from "../providers/types";
import { UnsupportedPayoutError } from "../corridors/recipient-schema";

/**
 * Shared API plumbing: one error shape, one place that decides what a client is
 * allowed to see.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Sign in to continue") =>
  new ApiError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have access to this") =>
  new ApiError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new ApiError(404, "NOT_FOUND", message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "CONFLICT", message, details);
export const tooManyRequests = (message = "Too many requests. Try again shortly.") =>
  new ApiError(429, "RATE_LIMITED", message);

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, { status });
}

/**
 * Convert anything thrown in a route into a safe response.
 *
 * Unexpected errors return a generic message: internal details never reach the
 * client, but they are logged server-side with the request id.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Some details need fixing",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof AmountOutOfRangeError) {
    return NextResponse.json(
      { error: { code: "AMOUNT_OUT_OF_RANGE", message: error.message } },
      { status: 422 },
    );
  }

  if (error instanceof UnsupportedPayoutError) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_PAYOUT", message: "That payout method is not available yet" } },
      { status: 422 },
    );
  }

  if (error instanceof InvalidTransferTransitionError) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "That action is not available for this transfer" } },
      { status: 409 },
    );
  }

  if (error instanceof NoFeeRuleError || error instanceof ProviderNotConfiguredError) {
    console.error("[remit] configuration error:", error.message);
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "This service is temporarily unavailable. Please try again later.",
        },
      },
      { status: 503 },
    );
  }

  if (error instanceof ProviderError) {
    console.error(`[remit] provider error (${error.provider}):`, error.message);
    return NextResponse.json(
      {
        error: {
          code: "PROVIDER_ERROR",
          message: error.retryable
            ? "Our payment provider is not responding. Please try again in a moment."
            : "We could not process that with our payment provider.",
        },
      },
      { status: 502 },
    );
  }

  console.error("[remit] unhandled error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side" } },
    { status: 500 },
  );
}

/** Parse and validate a JSON body. Never trust the client's shape. */
export async function parseBody<S extends ZodSchema>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Expected a JSON body");
  }
  return schema.parse(raw);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function userAgent(request: Request): string {
  return request.headers.get("user-agent")?.slice(0, 255) ?? "unknown";
}

/** Wrap a route handler so every thrown error becomes a consistent response. */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
