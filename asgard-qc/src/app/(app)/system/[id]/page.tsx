import Link from "next/link";
import { notFound } from "next/navigation";
import { countLabel } from "@/components/system/SystemHealthPanel";
import { Badge, Card, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CheckResult } from "@/lib/monitor/checks";
import { fmtDublin, TIME_ZONE } from "@/lib/monitor/schedule";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Review report" };

const GROUPS = [["application", "Application, database, storage and jobs"], ["integrity", "Data integrity"], ["quality", "Manufacturing quality review"], ["alerts", "Smart Quality Alerts"]] as const;

export default async function RunReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("system.view");
  const { id } = await params;
  const sp = await searchParams;
  const r = await db.systemCheckRun.findUnique({ where: { id } });
  if (!r) notFound();
  const admin = actor.permissions.has("settings.manage");
  const detailed = admin && str(sp, "view") !== "summary";
  const checks = (r.checks ?? []) as unknown as CheckResult[];
  const s = r.summary as { health: string; qualityStatus: string; counts: Record<string, number>; alerts: { raised: number; reopened: number; cleared: number; open: Record<string, number>; newHighOrCritical: { id: string; code: string; title: string; severity: string }[] }; projectsAffected: string[] } | null;
  const ch = r.changes as { previousRunId: string | null; previousCode: string | null; counts: Record<string, { before: number; after: number }>; newProblems: string[]; resolvedProblems: string[]; recordsChanged: number | null } | null;
  const actions = (r.actions ?? []) as { priority: string; text: string; links: { ref: string; href: string }[] }[];
  const notes = (r.notifications ?? []) as { channel: string; outcome: string; recipients?: number }[];
  const notRun = checks.filter((c) => c.status === "ERROR" || c.status === "SKIPPED");

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${r.code} — ${r.slotTime ? `${r.slotTime} scheduled review, ${r.slotDate}` : `${r.kind.toLowerCase()} review`}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={r.status} /> <span className="text-xs">System</span> <Badge value={r.health} /> <span className="text-xs">Quality</span> <Badge value={r.qualityStatus} />
            <Link className="link" href="/system">All runs</Link>
            {admin && <Link className="link" href={detailed ? `/system/${r.id}?view=summary` : `/system/${r.id}`}>{detailed ? "Management summary" : "Detailed view"}</Link>}
          </span>
        }
      />
      <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
        System health describes the application. Manufacturing quality status reflects open records and alerts. Neither is a statement that a project or the factory is compliant.
      </div>
      <Card title="Run">
        <KV cols={3} items={[
          ["Scheduled for", r.scheduledFor ? fmtDublin(r.scheduledFor) : "Not a scheduled slot"],
          ["Started", fmtDublin(r.startedAt)],
          ["Completed", fmtDublin(r.finishedAt)],
          ["Duration", r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"],
          ["Triggered by", r.triggeredBy],
          ["Checks", `${r.passed} passed · ${r.warnings} warnings · ${r.failed} failed · ${r.notRun} not run`],
          ["Time zone", TIME_ZONE],
          ["Compared with", ch?.previousRunId ? <Link key="p" className="link" href={`/system/${ch.previousRunId}`}>{ch.previousCode}</Link> : "No previous review"],
          ["Error", r.error],
        ]} />
      </Card>

      {s && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Outstanding quality position">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Object.entries(s.counts).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-ink-300">{countLabel(k)}</span><span>{v}{ch?.counts[k] && <span className={ch.counts[k].after > ch.counts[k].before ? "ml-1 text-xs text-warn-400" : "ml-1 text-xs text-ok-400"}>(was {ch.counts[k].before})</span>}</span></div>
              ))}
            </div>
            <p className="mt-3 text-sm">Open alerts: critical {s.alerts.open.CRITICAL ?? 0}, high {s.alerts.open.HIGH ?? 0}, medium {s.alerts.open.MEDIUM ?? 0}, low {s.alerts.open.LOW ?? 0}. This run: {s.alerts.raised} new, {s.alerts.reopened} reopened, {s.alerts.cleared} cleared.</p>
            {s.alerts.newHighOrCritical.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">{s.alerts.newHighOrCritical.map((a) => <li key={a.id}><Badge value={a.severity} /> <Link className="link" href={`/alerts/${a.id}`}>{a.code}</Link> {a.title}</li>)}</ul>
            )}
            {s.projectsAffected.length > 0 && <p className="mt-2 text-xs text-ink-300">Projects affected: {s.projectsAffected.join(", ")}</p>}
          </Card>
          <Card title="Changes since the previous review">
            {ch?.previousRunId ? (
              <div className="space-y-2 text-sm">
                <div><span className="label">New problems</span> {ch.newProblems.length ? ch.newProblems.join("; ") : "none"}</div>
                <div><span className="label">Resolved</span> {ch.resolvedProblems.length ? ch.resolvedProblems.join("; ") : "none"}</div>
                <div><span className="label">Records changed</span> {ch.recordsChanged ?? "—"}</div>
              </div>
            ) : <p className="text-sm text-ink-300">First review — nothing to compare with.</p>}
          </Card>
        </div>
      )}

      <Card title={`Recommended next actions (${actions.length})`}>
        {actions.length ? (
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {(detailed ? actions : actions.slice(0, 8)).map((a, i) => (
              <li key={i} className={a.priority === "high" ? "text-bad-400" : "text-ink-100"}>
                <span className="text-ink-100">{a.text}</span>
                {a.links.length > 0 && <span className="ml-1 text-xs">{a.links.map((l) => <Link key={l.href + l.ref} className="link mr-2" href={l.href}>{l.ref}</Link>)}</span>}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-ink-300">Nothing needs attention from this review.</p>}
        <p className="mt-3 text-xs text-ink-300">Corrections go through the normal records and approval workflow. The review never changes quality records itself.</p>
      </Card>

      {notRun.length > 0 && (
        <Card title="Checks not completed">
          <ul className="space-y-1 text-sm">{notRun.map((c) => <li key={c.key}><Badge value={c.status} /> <span className="text-ink-100">{c.label}</span> — {c.detail}</li>)}</ul>
        </Card>
      )}

      {detailed && GROUPS.map(([g, title]) => {
        const rows = checks.filter((c) => c.group === g);
        if (!rows.length) return null;
        return (
          <Card key={g} title={title} pad={false}>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Check</th><th>Result</th><th>Detail</th><th>Time</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.key}>
                      <td className="whitespace-nowrap">{c.label}</td>
                      <td><Badge value={c.status} /></td>
                      <td>
                        <div>{c.detail}</div>
                        {c.items && c.items.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-ink-300">
                            {c.items.slice(0, 15).map((i, n) => <li key={n}>{i.href ? <Link className="link" href={i.href}>{i.ref}</Link> : i.ref}{i.note && ` — ${i.note}`}</li>)}
                            {c.items.length > 15 && <li>… {c.items.length - 15} more</li>}
                          </ul>
                        )}
                      </td>
                      <td className="text-xs">{c.ms != null ? `${c.ms} ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      <Card title="Notifications">
        <ul className="space-y-1 text-sm">{notes.map((n, i) => <li key={i}><span className="text-ink-100">{n.channel}</span>{n.recipients != null && ` · ${n.recipients} recipient(s)`} — {n.outcome}</li>)}</ul>
      </Card>
    </div>
  );
}
