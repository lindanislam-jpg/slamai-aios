import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { humanize } from "@/lib/domain/constants";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card animate-rise", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-600/70 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(pad && "card-pad")}>{children}</div>
    </section>
  );
}

const OK = /^(PASS|ACCEPT|ACCEPTED|VERIFIED|CLOSED|RELEASED|RELEASED_WITH_CONCESSION|APPROVED|CURRENT|COMPLETED|DEFINED|LOW|REVIEWED)$/;
const BAD = /^(FAIL|REJECT|REJECTED|CRITICAL|HIGH|EXPIRED|QUARANTINED|OVERDUE|REPAIR_REQUIRED|MISSING|REVOKED|CANCELLED|NONCONFORMITY)$/;
const WARN = /^(PENDING|HOLD|OPEN|MEDIUM|AWAITING_INSPECTION|AWAITING_REINSPECTION|AWAITING_VERIFICATION|AWAITING_RELEASE|UPLOADED_UNVERIFIED|PENDING_REVIEW|IN_PROGRESS|ACTION_IN_PROGRESS|INVESTIGATING|CONTAINED|DUE_SOON|SUBMITTED|DRAFT|UNDER_REVIEW|REQUIRES_CONFIGURATION|NO_RECORD|ON_HOLD|OBSERVATION|PLANNED)$/;

export function Badge({ value, label, tone }: { value?: string | null; label?: ReactNode; tone?: "ok" | "bad" | "warn" | "info" | "neutral" | "gold" }) {
  const v = (value ?? "").toUpperCase();
  const t = tone ?? (OK.test(v) ? "ok" : BAD.test(v) ? "bad" : WARN.test(v) ? "warn" : v === "ACTIVE" || v === "INFO" ? "info" : "neutral");
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
        t === "ok" && "border-ok-600/50 bg-ok-600/15 text-ok-400",
        t === "bad" && "border-bad-600/50 bg-bad-600/15 text-bad-400",
        t === "warn" && "border-warn-600/50 bg-warn-600/15 text-warn-400",
        t === "info" && "border-info-500/40 bg-info-500/10 text-info-400",
        t === "gold" && "border-gold-600/60 bg-gold-600/15 text-gold-300",
        t === "neutral" && "border-ink-500 bg-ink-700 text-ink-200",
      )}
    >
      {label ?? humanize(value)}
    </span>
  );
}

export function DemoTag({ show }: { show: boolean }) {
  if (!show) return null;
  return <Badge tone="gold" label="DEMO" />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-500 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-200">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-300">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, href, title }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "bad" | "warn" | "gold"; href?: string; title?: string }) {
  const body = (
    <div title={title} className={clsx("card card-pad h-full transition", href && "hover:border-gold-600/60")}>
      <div className="text-xs font-medium text-ink-300">{label}</div>
      <div className={clsx("mt-1.5 text-2xl font-semibold tabular-nums", tone === "ok" && "text-ok-400", tone === "bad" && "text-bad-400", tone === "warn" && "text-warn-400", tone === "gold" && "text-gold-300", !tone && "text-ink-100")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-300">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-600" aria-label="Tabs">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.key}`}
          className={clsx(
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            active === t.key ? "border-gold-500 text-gold-300" : "border-transparent text-ink-300 hover:text-ink-100",
          )}
          aria-current={active === t.key ? "page" : undefined}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded bg-ink-700 px-1.5 text-[11px] text-ink-300">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function KV({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={clsx("grid gap-x-6 gap-y-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", cols === 4 && "sm:grid-cols-2 lg:grid-cols-4")}>
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-300">{k}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink-100">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

export function History({ events }: { events: { id: string; at: Date; actorName: string | null; action: string; summary: string | null }[] }) {
  if (!events.length) return <p className="text-sm text-ink-300">No history.</p>;
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
          <div>
            <div className="text-ink-100">{e.summary ?? e.action}</div>
            <div className="text-xs text-ink-300">
              {fmtDateTime(e.at)} · {e.actorName ?? "system"} · <code className="text-ink-400">{e.action}</code>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
