import Link from "next/link";
import type { AlertSeverity, AlertStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { FilterBar, FilterSelect } from "@/components/fields";
import { Badge, Card, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { projectOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { ALERT_CATEGORIES } from "@/lib/services/alert-rules";
import { alertCounts, listAlerts } from "@/lib/services/alerts";
import { rescanAction } from "./actions";

export const metadata = { title: "Smart Quality Alerts" };

const SEV: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const label = (s: string) => s.replace(/_/g, " ").toLowerCase();

export default async function Alerts({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const status = (str(sp, "status") ?? "open") as "open" | "closed" | AlertStatus;
  const [rows, counts, projects] = await Promise.all([
    listAlerts(actor, { status, severity: str(sp, "severity") as AlertSeverity | null, category: str(sp, "category"), projectId: str(sp, "projectId") }),
    alertCounts(),
    projectOptions(),
  ]);
  const now = Date.now();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Smart Quality Alerts"
        subtitle="Raised automatically from stored records by configurable rules. Each alert shows the records that triggered it."
        actions={actor.permissions.has("alert.manage") && <ActionForm inline action={rescanAction} submit="Re-evaluate now" submitClass="btn-secondary" />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {SEV.map((s) => (
          <Stat key={s} label={label(s)} value={counts.bySeverity[s]} tone={s === "CRITICAL" || s === "HIGH" ? (counts.bySeverity[s] ? "bad" : undefined) : s === "MEDIUM" && counts.bySeverity[s] ? "warn" : undefined} href={`/alerts?severity=${s}`} />
        ))}
        <Stat label="Open > 30 days" value={counts.ageing["> 30 days"]} sub={`${counts.ageing["7–30 days"]} at 7–30 days`} tone={counts.ageing["> 30 days"] ? "warn" : undefined} />
      </div>

      <FilterBar reset="/alerts">
        <FilterSelect name="status" label="Status" value={status} empty="Open" options={[{ value: "closed", label: "Resolved / dismissed" }, ...(["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const).map((s) => ({ value: s, label: label(s) }))]} />
        <FilterSelect name="severity" label="Severity" value={str(sp, "severity")} options={SEV.map((s) => ({ value: s, label: label(s) }))} />
        <FilterSelect name="category" label="Category" value={str(sp, "category")} options={[...ALERT_CATEGORIES]} />
        <FilterSelect name="projectId" label="Project" value={str(sp, "projectId")} options={projects} />
      </FilterBar>

      <Card title={`Alerts (${rows.length})`} pad={false}>
        {rows.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Alert</th><th>Severity</th><th>What triggered it</th><th>Category</th><th>Project</th><th>Raised</th><th>Owner</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap"><Link className="link font-medium" href={`/alerts/${a.id}`}>{a.code}</Link>{a.reopenCount > 0 && <span className="ml-1 text-xs text-warn-400">reopened ×{a.reopenCount}</span>}</td>
                    <td><Badge value={a.severity} /></td>
                    <td className="max-w-md"><div className="text-ink-100">{a.title}</div>{a.detail && <div className="truncate text-xs text-ink-300" title={a.detail}>{a.detail}</div>}</td>
                    <td className="text-xs">{a.category}</td>
                    <td>{a.project?.code ?? "—"}</td>
                    <td className="whitespace-nowrap">{fmtDate(a.firstRaisedAt)}<div className="text-xs text-ink-300">{Math.floor((now - a.firstRaisedAt.getTime()) / 86_400_000)} d</div></td>
                    <td>{a.assignedToName ?? "—"}</td>
                    <td><Badge value={a.status} />{a.conditionClearedAt && a.status !== "RESOLVED" && <div className="text-xs text-ok-400">condition cleared</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={status === "open" ? "No open alerts. Rules are evaluated every few minutes and after relevant changes." : "No alerts match these filters."} />
        )}
      </Card>
      <p className="text-xs text-ink-300">Rules and thresholds are set by an administrator in Settings → Alert rules. Alerts are decision support only; they never accept, release or close a record.</p>
    </div>
  );
}
