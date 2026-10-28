import Link from "next/link";
import type { SystemCheckRun } from "@prisma/client";
import { Badge, Card } from "@/components/ui";
import { fmtDublin, TIME_ZONE, type Slot } from "@/lib/monitor/schedule";
import { LiveRefresh } from "./LiveRefresh";

type Summary = {
  health: string;
  qualityStatus: string;
  technical: { database: string; storage: string; jobs: string; integrity: string };
  counts: Record<string, number>;
  alerts: { raised: number; reopened: number; cleared: number; open: Record<string, number> };
  projectsAffected: string[];
};
type Changes = { newProblems: string[]; resolvedProblems: string[]; counts: Record<string, { before: number; after: number }>; recordsChanged: number | null };

const LABELS: Record<string, string> = {
  overdueInspections: "Overdue inspections", failedNoNcr: "Failed inspections without NCR", openNcrs: "Open NCRs", overdueNcrs: "Overdue NCRs", overdueActions: "Overdue CAPA actions",
  openCmrs: "Open CMRs", overdueCmrs: "Overdue CMRs", materialIssues: "Material traceability issues", ndtOutstanding: "NDT outstanding", reworkAwaiting: "Rework awaiting inspection",
  calibrationDue: "Calibration due", evidenceMissing: "Projects missing evidence", releaseBlockers: "Release blockers", integrityIssues: "Data-integrity issues",
};
export const countLabel = (k: string) => LABELS[k] ?? k;

export function SystemHealthPanel({ latest, lastGood, next, enabled, schedulerSilent, running, compact = false, canOpen = true }: { latest: SystemCheckRun | null; lastGood: SystemCheckRun | null; next: Slot; enabled: boolean; schedulerSilent: boolean; running: { code: string } | null; compact?: boolean; canOpen?: boolean }) {
  const s = (lastGood?.summary ?? null) as Summary | null;
  const ch = (lastGood?.changes ?? null) as Changes | null;
  const latestBad = latest && latest.id !== lastGood?.id && (latest.status === "FAILED" || latest.status === "RUNNING");
  return (
    <Card
      title={<span className="flex items-center gap-2">System Health &amp; Scheduled Review {running ? <Badge value="RUNNING" label={`Running ${running.code}`} /> : s && <Badge value={s.health} />}</span>}
      actions={canOpen && <Link href={lastGood ? `/system/${lastGood.id}` : "/system"} className="btn-secondary btn-sm">{lastGood ? "Latest report" : "System monitor"}</Link>}
    >
      <LiveRefresh latestId={latest?.id ?? null} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><div className="label">Last successful check</div><div className="text-ink-100">{fmtDublin(lastGood?.finishedAt)}</div>{lastGood && <div className="text-xs text-ink-300">{lastGood.code} · <Badge value={lastGood.status} /></div>}</div>
            <div><div className="label">Next scheduled check</div><div className="text-ink-100">{enabled ? fmtDublin(next.at) : "Scheduled checks disabled"}</div><div className="text-xs text-ink-300">09:00 · 12:00 · 18:00 {TIME_ZONE}</div></div>
          </div>
          {latestBad && <p className="rounded border border-bad-400/40 bg-bad-400/5 px-3 py-2 text-xs text-bad-400">Latest run {latest!.code} {latest!.status.toLowerCase()}{latest!.error ? `: ${latest!.error}` : ""}</p>}
          {schedulerSilent && enabled && <p className="rounded border border-warn-400/40 bg-warn-400/5 px-3 py-2 text-xs text-warn-400">The host scheduler has not called in over 8 hours. Reviews still run when the app is used, but check Vercel → Cron Jobs.</p>}
          {s ? (
            <>
              <div>
                <div className="label">Technical system health</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span>Overall <Badge value={s.health} /></span>
                  <span>Database <Badge value={s.technical.database} /></span>
                  <span>File storage <Badge value={s.technical.storage} /></span>
                  <span>Background jobs <Badge value={s.technical.jobs} /></span>
                  <span>Data integrity <Badge value={s.technical.integrity} /></span>
                </div>
                <div className="mt-1 text-xs text-ink-300">{lastGood!.passed} passed · {lastGood!.warnings} warnings · {lastGood!.failed} failed · {lastGood!.notRun} not run</div>
              </div>
              <p className="text-xs text-ink-300">Technical health describes the application only. It does not mean any project or the factory is compliant — see manufacturing quality below.</p>
            </>
          ) : (
            <p className="text-ink-300">No review has completed yet. The first runs at the next scheduled time{enabled ? "" : " once scheduled checks are enabled"}.</p>
          )}
        </div>
        {s && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="label">Manufacturing quality status</div>
              <div className="mt-1 flex flex-wrap items-center gap-2"><Badge value={s.qualityStatus} /><span className="text-xs text-ink-300">Critical alerts {s.alerts.open.CRITICAL ?? 0} · High {s.alerts.open.HIGH ?? 0}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {(compact ? ["overdueNcrs", "overdueActions", "failedNoNcr", "overdueCmrs", "releaseBlockers", "integrityIssues"] : Object.keys(s.counts)).map((k) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-ink-300">{countLabel(k)}</span><span className={s.counts[k] ? "text-ink-100" : "text-ink-300"}>{s.counts[k]}</span></div>
              ))}
            </div>
            <div className="text-xs text-ink-200">Alerts this run: {s.alerts.raised} new · {s.alerts.reopened} reopened · {s.alerts.cleared} cleared</div>
            {ch && (
              <div className="text-xs text-ink-200">
                Since previous review: {ch.newProblems.length ? <span className="text-warn-400">new — {ch.newProblems.slice(0, 3).join("; ")}{ch.newProblems.length > 3 ? "…" : ""}</span> : "no new problems"}
                {Object.keys(ch.counts).length > 0 && <span> · changed: {Object.entries(ch.counts).slice(0, 3).map(([k, v]) => `${countLabel(k)} ${v.before}→${v.after}`).join(", ")}</span>}
                {ch.recordsChanged != null && <span> · {ch.recordsChanged} records changed</span>}
              </div>
            )}
            {s.projectsAffected.length > 0 && <div className="text-xs text-ink-300">Projects affected: {s.projectsAffected.slice(0, 10).join(", ")}{s.projectsAffected.length > 10 ? ` +${s.projectsAffected.length - 10}` : ""}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}
