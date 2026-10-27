/** Errors whose message is safe to show to the user. Anything else is logged
 *  and replaced with a generic message. */
export class AppError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AppError";
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, 403);
  }
}
export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(`${what} not found.`, 404);
  }
}
export class ValidationError extends AppError {
  constructor(message: string, readonly fields?: Record<string, string>) {
    super(message, 422);
  }
}

export function publicMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
    return "A record with that reference already exists.";
  }
  console.error(err);
  return "Something went wrong. The error has been logged.";
}
