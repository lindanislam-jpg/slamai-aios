/**
 * Deployment preflight checks.
 *
 * A misconfigured deployment used to fail as an opaque "Server error" page from
 * NextAuth, with nothing in the UI saying which variable was missing. These
 * checks turn that into a specific, actionable answer.
 *
 * SAFETY: a check never reports the *value* of anything — only whether it is
 * present. Reporting that a deployment is missing its auth secret tells an
 * attacker nothing they could not already infer from every login failing, and
 * it saves the operator an hour of guessing.
 */

export type CheckStatus = "ok" | "missing" | "error" | "warning";

export interface ConfigCheck {
  name: string;
  status: CheckStatus;
  /** Actionable, and free of secret values by construction. */
  detail: string;
  /** A failing required check means the app cannot function at all. */
  required: boolean;
}

export interface PreflightReport {
  ok: boolean;
  checks: ConfigCheck[];
}

/** Environment variables the app cannot run without. */
const REQUIRED_ENV: { name: string; detail: string }[] = [
  {
    name: "NEXTAUTH_SECRET",
    detail:
      "Signs the session cookie. Without it NextAuth refuses to start and every " +
      "sign-in fails before the password is checked. Generate one with " +
      "`openssl rand -base64 32`.",
  },
  {
    name: "DATABASE_URL",
    detail:
      "Postgres connection string. Without it nothing can be read or written.",
  },
];

/** Just the shape this needs — not the whole `NodeJS.ProcessEnv`. */
export type EnvLike = Record<string, string | undefined>;

/**
 * Pure environment check. Takes the environment as an argument so it can be
 * tested without mutating the process.
 */
export function checkEnvironment(env: EnvLike = process.env): ConfigCheck[] {
  const checks: ConfigCheck[] = REQUIRED_ENV.map(({ name, detail }) => ({
    name,
    status: env[name] ? ("ok" as const) : ("missing" as const),
    detail: env[name] ? "Set." : detail,
    required: true,
  }));

  // Optional, but worth surfacing because their absence changes behaviour in
  // ways an operator will otherwise discover the hard way.
  const notificationProvider = env.REMIT_NOTIFICATION_PROVIDER || "sandbox";
  if (notificationProvider === "sandbox") {
    checks.push({
      name: "Email delivery",
      status: "warning",
      detail:
        "Using the sandbox notification provider: emails are recorded but never " +
        "delivered. New customers cannot receive a verification code. Set " +
        "REMIT_NOTIFICATION_PROVIDER=resend and RESEND_API_KEY to send real email.",
      required: false,
    });
  } else if (notificationProvider === "resend" && !env.RESEND_API_KEY) {
    checks.push({
      name: "Email delivery",
      status: "error",
      detail: "REMIT_NOTIFICATION_PROVIDER is 'resend' but RESEND_API_KEY is not set.",
      required: false,
    });
  } else {
    checks.push({
      name: "Email delivery",
      status: "ok",
      detail: `Using the ${notificationProvider} notification provider.`,
      required: false,
    });
  }

  return checks;
}

export function summarise(checks: ConfigCheck[]): PreflightReport {
  const ok = checks.every(
    (check) => !check.required || check.status === "ok" || check.status === "warning",
  );
  return { ok, checks };
}

/** The required checks that are currently failing, for a UI banner. */
export function blockingProblems(checks: ConfigCheck[]): ConfigCheck[] {
  return checks.filter(
    (check) => check.required && check.status !== "ok" && check.status !== "warning",
  );
}
