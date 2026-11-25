import { blockingProblems, type ConfigCheck } from "@/remit/config/preflight";
import { Card } from "./ui";

/**
 * Shown when the deployment cannot work because something is not configured.
 *
 * The failure this replaces was a blank "Server error" page from NextAuth with
 * no indication of which variable was missing. Naming the specific problem is
 * the entire point.
 *
 * Only statuses and remediation text reach the browser — never a value.
 */
export function SetupRequired({ checks }: { checks: ConfigCheck[] }) {
  const problems = checks.filter((check) => check.status !== "ok");
  const blocking = blockingProblems(checks);

  if (problems.length === 0) {
    return (
      <Card>
        <h1 className="text-[22px] font-bold tracking-tight text-send-ink">
          Everything is configured
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-send-body">
          All required configuration is present, and the database is reachable and seeded.
        </p>
      </Card>
    );
  }

  // A deployment can be working and still be worth a note — a demo running on
  // the sandbox email provider, for instance. Calling that "not configured"
  // would send someone hunting for a problem that isn't there.
  const isBroken = blocking.length > 0;

  return (
    <Card>
      <h1 className="text-[24px] font-bold tracking-tight text-send-ink">
        {isBroken ? "This deployment isn't configured yet" : "Configured, with one thing to know"}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-send-body">
        {isBroken
          ? "The application is running, but it is missing configuration it cannot work without. Nothing is wrong with your account or your password — sign-in fails before any credential is checked."
          : "Everything required is in place and the app works. The item below changes how it behaves, so it is worth knowing about."}
      </p>

      <ul className="mt-6 space-y-3">
        {problems.map((check) => (
          <li
            key={check.name}
            className={`rounded-xl border px-4 py-3.5 ${
              check.status === "warning"
                ? "border-send-accent/40 bg-send-accent-soft"
                : "border-send-danger/30 bg-send-danger-soft"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                  check.status === "warning"
                    ? "bg-send-accent text-white"
                    : "bg-send-danger text-white"
                }`}
              >
                {check.status === "warning" ? "Heads up" : "Missing"}
              </span>
              <span className="font-mono text-[13px] font-bold text-send-ink">{check.name}</span>
            </div>
            <p
              className={`mt-1.5 text-[13px] leading-relaxed ${
                check.status === "warning" ? "text-send-warning" : "text-send-danger"
              }`}
            >
              {check.detail}
            </p>
          </li>
        ))}
      </ul>

      {isBroken && (
      <div className="mt-7 rounded-xl bg-send-canvas p-5">
        <h2 className="text-[14px] font-bold text-send-ink">To fix it</h2>
        <ol className="mt-2 space-y-2 text-[13px] leading-relaxed text-send-body">
          <li>
            <strong>1.</strong> Set the variables above in your hosting environment. On Vercel
            these are per-environment — a preview deployment needs them ticked for{" "}
            <strong>Preview</strong>, not just Production.
          </li>
          <li>
            <strong>2.</strong> Redeploy. Environment variables are not applied to a build that
            already exists.
          </li>
          <li>
            <strong>3.</strong> Point <code className="font-mono">DATABASE_URL</code> at your
            database locally and run <code className="font-mono">npm run db:push</code> then{" "}
            <code className="font-mono">npm run db:seed:remit</code> to create the schema and the
            reference data.
          </li>
        </ol>
        <p className="mt-3 text-[12px] leading-relaxed text-send-muted">
          <code className="font-mono">/api/remit/health</code> reports the same checks as JSON and
          returns 503 while anything required is missing.
        </p>
      </div>
      )}
    </Card>
  );
}
