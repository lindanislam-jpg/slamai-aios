import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SystemHealthPanel } from "@/components/system/SystemHealthPanel";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { monitorStatus } from "@/lib/monitor/run";
import { fmtDublin, TIME_ZONE } from "@/lib/monitor/schedule";
import { retryRunAction, runNowAction, saveMonitorSettingsAction } from "./actions";

export const metadata = { title: "System Monitor" };

export default async function SystemMonitor() {
  const actor = await requirePagePermission("system.view");
  const admin = actor.permissions.has("settings.manage");
  const [st, runs, users] = await Promise.all([
    monitorStatus(),
    db.systemCheckRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 }),
    admin ? db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }) : Promise.resolve([]),
  ]);
  const trend = runs.filter((r) => r.status === "COMPLETED" || r.status === "PARTIAL").slice(0, 14);
  const c = st.cfg;

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Monitor & Scheduled Reviews"
        subtitle={`Automatic whole-system and quality review at 09:00, 12:00 and 18:00 (${TIME_ZONE}). Reads and checks records only — it never approves, closes, releases or changes quality data.`}
        actions={admin && <ActionForm inline action={runNowAction} submit="Run health check now" submitClass="btn-primary" />}
      />
      <SystemHealthPanel latest={st.latest} lastGood={st.lastGood} next={st.next} enabled={st.enabled} schedulerSilent={st.schedulerSilent} running={st.running} />

      <Card title="Scheduler">
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><div className="label">Status</div><Badge value={st.enabled ? (st.schedulerSilent ? "WARNING" : "HEALTHY") : "DISABLED"} label={st.enabled ? (st.schedulerSilent ? "Enabled — host scheduler silent" : "Enabled") : "Disabled"} /></div>
          <div><div className="label">Schedule</div>{st.slots.join(" · ")} {TIME_ZONE}<div className="text-xs text-ink-300">Follows Irish summer/winter time automatically.</div></div>
          <div><div className="label">Next expected run</div>{st.enabled ? fmtDublin(st.next.at) : "—"}</div>
          <div><div className="label">Last call from host scheduler</div>{fmtDublin(st.lastTick)}<div className="text-xs text-ink-300">Vercel Cron, 6 daily calls (08, 09, 11, 12, 17, 18 UTC)</div></div>
        </div>
      </Card>

      {admin && (
        <Card title="Settings (administrators)">
          <ActionForm action={saveMonitorSettingsAction} submit="Save settings">
            <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> Scheduled checks enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="escalateCritical" defaultChecked={c.escalateCritical} /> Escalate critical failures / new critical alerts immediately</label>
              <label className="text-xs text-ink-300">Notify recipients
                <select name="notifyOn" defaultValue={c.notifyOn} className="input mt-1"><option value="changes">Only when there are new issues, failures or escalations</option><option value="every">After every review</option></select>
              </label>
              <label className="text-xs text-ink-300">Catch-up window after an outage (hours)<input name="catchUpHours" type="number" min={0} max={12} defaultValue={c.catchUpHours} className="input mt-1" /></label>
              <label className="text-xs text-ink-300">Time limit per check (seconds)<input name="checkTimeoutSeconds" type="number" min={5} max={60} defaultValue={c.checkTimeoutSeconds} className="input mt-1" /></label>
              <label className="text-xs text-ink-300">Keep review reports for (days)<input name="retentionDays" type="number" min={30} max={3650} defaultValue={c.retentionDays} className="input mt-1" /></label>
              <label className="text-xs text-ink-300">Flag alerts open longer than (days)<input name="alertOverdueDays" type="number" min={1} max={365} defaultValue={c.alertOverdueDays} className="input mt-1" /></label>
            </div>
            <fieldset className="mt-4">
              <legend className="label">Report recipients (in-app; administrators always receive failures and escalations)</legend>
              <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
                {users.map((u) => <label key={u.id} className="flex items-center gap-2"><input type="checkbox" name="recipientUserIds" value={u.id} defaultChecked={c.recipientUserIds.includes(u.id)} /> {u.name} <span className="text-xs text-ink-300">{u.role.replace(/_/g, " ").toLowerCase()}</span></label>)}
              </div>
            </fieldset>
            <p className="mt-3 text-xs text-ink-300">Email: no provider is configured, so reports are delivered in-app only and nothing is sent outside the application. Alert thresholds are set in <Link className="link" href="/settings?tab=alerts">Settings → Alert rules</Link>.</p>
          </ActionForm>
        </Card>
      )}

      {trend.length > 1 && (
        <Card title="Trend — last completed reviews" pad={false}>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Review</th><th>Health</th><th>Quality</th><th>Critical / high alerts</th><th>Open NCRs</th><th>Overdue NCRs</th><th>Failed insp. no NCR</th><th>Open CMRs</th><th>Integrity issues</th></tr></thead>
              <tbody>
                {trend.map((r) => {
                  const s = r.summary as { counts: Record<string, number>; alerts: { open: Record<string, number> } } | null;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap"><Link className="link" href={`/system/${r.id}`}>{r.slotTime ? `${r.slotDate} ${r.slotTime}` : fmtDublin(r.startedAt)}</Link></td>
                      <td><Badge value={r.health} /></td>
                      <td><Badge value={r.qualityStatus} /></td>
                      <td>{s ? `${s.alerts.open.CRITICAL ?? 0} / ${s.alerts.open.HIGH ?? 0}` : "—"}</td>
                      <td>{s?.counts.openNcrs ?? "—"}</td>
                      <td>{s?.counts.overdueNcrs ?? "—"}</td>
                      <td>{s?.counts.failedNoNcr ?? "—"}</td>
                      <td>{s?.counts.openCmrs ?? "—"}</td>
                      <td>{s?.counts.integrityIssues ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={`Run history (${runs.length})`} pad={false}>
        {runs.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Run</th><th>Scheduled</th><th>Type</th><th>Started (Ireland)</th><th>Duration</th><th>Status</th><th>Health</th><th>Checks</th><th>Triggered by</th>{admin && <th></th>}</tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.status === "MISSED" ? r.code : <Link className="link font-medium" href={`/system/${r.id}`}>{r.code}</Link>}</td>
                    <td className="whitespace-nowrap">{r.slotTime ? `${r.slotDate} ${r.slotTime}` : "—"}</td>
                    <td className="text-xs">{r.kind.toLowerCase()}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDublin(r.startedAt)}</td>
                    <td className="text-xs">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"}</td>
                    <td><Badge value={r.status} />{r.error && <div className="max-w-xs truncate text-xs text-bad-400" title={r.error}>{r.error}</div>}</td>
                    <td><Badge value={r.health} /></td>
                    <td className="whitespace-nowrap text-xs">{r.status === "MISSED" ? "—" : `${r.passed} ✓ · ${r.warnings} ! · ${r.failed} ✗ · ${r.notRun} not run`}</td>
                    <td className="text-xs">{r.triggeredBy}</td>
                    {admin && <td>{["FAILED", "PARTIAL", "MISSED"].includes(r.status) && <ActionForm inline action={retryRunAction.bind(null, r.id)} submit="Retry" submitClass="btn-secondary btn-sm" />}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No reviews yet." />
        )}
      </Card>
    </div>
  );
}
