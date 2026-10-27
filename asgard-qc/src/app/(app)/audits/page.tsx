import { FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { listAudits } from "@/lib/services/audits";
import { saveAuditAction } from "./actions";
import { auditFields } from "./fields";

export const metadata = { title: "Audit & Compliance" };

export default async function Audits() {
  const actor = await requirePagePermission("records.view");
  const audits = await listAudits(actor);
  const now = new Date();
  const upcoming = audits.filter((a) => a.scheduledAt >= now && a.status !== "CANCELLED").sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = audits.filter((a) => !upcoming.includes(a));
  const openFindings = audits.flatMap((a) => a.findings.filter((f) => f.status !== "CLOSED"));
  const overdue = openFindings.filter((f) => f.dueDate && f.dueDate < now);

  const table = (rows: typeof audits) => (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Audit</th><th>Title</th><th>Type</th><th>Date</th><th>Auditor</th><th>Open findings</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((a) => {
            const open = a.findings.filter((f) => f.status !== "CLOSED");
            return (
              <tr key={a.id}>
                <td className="whitespace-nowrap"><Link className="link font-medium" href={`/audits/${a.id}`}>{a.code}</Link> <DemoTag show={a.isDemo} /></td>
                <td>{a.title}</td>
                <td>{a.auditType}</td>
                <td className="whitespace-nowrap">{fmtDate(a.scheduledAt)}</td>
                <td>{a.auditor ?? "—"}</td>
                <td className={open.some((f) => f.dueDate && f.dueDate < now) ? "text-bad-400" : ""}>{open.length} / {a.findings.length}</td>
                <td><Badge value={a.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit & Compliance Centre"
        subtitle="Audit schedule, checklists, findings, owners and verified closure."
        actions={actor.permissions.has("export.excel") && <a className="btn-secondary" href={"/api/export/audits"} download><FileDown className="h-4 w-4" /> Excel</a>}
      />
      <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
        Having an audit checklist here does not mean ASGARD complies with ISO 9001, EN 1090 or any other standard. Applicable standards, editions, scope and acceptance criteria must be verified by authorised personnel.
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Upcoming audits" value={upcoming.length} />
        <Stat label="Open findings" value={openFindings.length} tone={openFindings.length ? "warn" : undefined} />
        <Stat label="Overdue findings" value={overdue.length} tone={overdue.length ? "bad" : undefined} />
        <Stat label="Nonconformities open" value={openFindings.filter((f) => f.type === "NONCONFORMITY").length} />
      </div>
      {actor.permissions.has("audit.write") && (
        <Card title="Schedule an audit">
          <details>
            <summary className="cursor-pointer text-sm text-ink-200">New audit</summary>
            <div className="mt-3">
              <ActionForm action={saveAuditAction.bind(null, null)} submit="Schedule audit">
                <Fields fields={auditFields()} />
              </ActionForm>
            </div>
          </details>
        </Card>
      )}
      <Card title="Upcoming">{upcoming.length ? table(upcoming) : <Empty title="No upcoming audits scheduled." />}</Card>
      <Card title="Past and in progress">{past.length ? table(past) : <Empty title="No audit history." />}</Card>
    </div>
  );
}
