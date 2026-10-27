import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterSelect, type FieldDef } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { NDT_METHODS } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { listNdt } from "@/lib/services/ndt-coating";
import { saveNdtAction } from "./actions";

export const metadata = { title: "NDT & Test Records" };

export default async function NdtPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const outstanding = str(sp, "outstanding") === "1";
  const editId = str(sp, "edit");
  const [rows, projects, units, welds, editing] = await Promise.all([
    listNdt(actor, { projectId, outstanding }),
    projectOptions(),
    unitOptions(projectId),
    db.weld.findMany({ where: projectId ? { projectId } : {}, orderBy: [{ project: { code: "desc" } }, { weldRef: "asc" }], select: { id: true, weldRef: true, project: { select: { code: true } } } }),
    editId ? db.ndtRecord.findUnique({ where: { id: editId } }) : null,
  ]);
  const canWrite = actor.permissions.has("ndt.write");
  const weldOpts = welds.map((w) => ({ value: w.id, label: `${w.project.code} / ${w.weldRef}` }));
  const pending = rows.filter((r) => r.result === "PENDING");
  const daysOpen = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

  const fields = (r?: typeof editing): FieldDef[] => [
    { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: r?.projectId ?? projectId },
    { name: "unitId", label: "Frame / module", type: "select", options: units, defaultValue: r?.unitId },
    { name: "weldId", label: "Weld", type: "select", options: weldOpts, defaultValue: r?.weldId ?? str(sp, "weldId") },
    { name: "method", label: "Method", type: "select", options: [...NDT_METHODS], required: true, defaultValue: r?.method },
    { name: "procedureRef", label: "Procedure reference", defaultValue: r?.procedureRef },
    { name: "componentRef", label: "Component / item", defaultValue: r?.componentRef },
    { name: "requestedAt", label: "Requested", type: "date", required: true, defaultValue: r?.requestedAt ?? new Date() },
    { name: "contractor", label: "Contractor", defaultValue: r?.contractor },
    { name: "personnelRef", label: "Qualified personnel ref", defaultValue: r?.personnelRef },
    { name: "reportNo", label: "Report number", defaultValue: r?.reportNo },
    { name: "reportDate", label: "Report date", type: "date", defaultValue: r?.reportDate },
    { name: "result", label: "Result (from the report)", type: "select", allowEmpty: false, options: [{ value: "PENDING", label: "Pending — no report yet" }, { value: "ACCEPT", label: "Accept" }, { value: "REJECT", label: "Reject" }], defaultValue: r?.result ?? "PENDING" },
    { name: "followUp", label: "Follow-up action", type: "textarea", span: 2, defaultValue: r?.followUp },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="NDT & Test Records" subtitle="Requests, reports and results. A result can only be recorded against a report number; this system does not interpret test data." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Records" value={rows.length} />
        <Stat label="Outstanding reports" value={pending.length} tone={pending.length ? "warn" : undefined} href="/ndt?outstanding=1" />
        <Stat label="Rejected" value={rows.filter((r) => r.result === "REJECT").length} tone="bad" />
        <Stat label="Oldest outstanding (days)" value={pending.length ? Math.max(...pending.map((r) => daysOpen(r.requestedAt))) : "—"} />
      </div>
      <FilterBar reset="/ndt">
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="outstanding" label="Show" options={[{ value: "1", label: "Outstanding only" }]} value={outstanding ? "1" : null} empty="All records" />
      </FilterBar>
      {rows.length === 0 ? <Empty title="No NDT records" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Project</th><th>Weld / item</th><th>Method</th><th>Procedure</th><th>Requested</th><th>Report</th><th>Contractor</th><th>Result</th><th>Follow-up</th><th></th></tr></thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="whitespace-nowrap">{n.code} <DemoTag show={n.isDemo} /></td>
                  <td>{n.project.code}</td>
                  <td>{n.weld ? <Link className="link" href={`/welding/${n.weld.id}`}>{n.weld.weldRef}</Link> : n.componentRef ?? n.unit?.ref ?? "—"}</td>
                  <td>{n.method}</td>
                  <td>{n.procedureRef ?? "—"}</td>
                  <td className="whitespace-nowrap">{fmtDate(n.requestedAt)}{n.result === "PENDING" && <span className="block text-xs text-warn-400">{daysOpen(n.requestedAt)} days open</span>}</td>
                  <td>{n.reportNo ? `${n.reportNo} · ${fmtDate(n.reportDate)}` : <span className="text-warn-400">Awaiting</span>}</td>
                  <td>{n.contractor ?? "—"}</td>
                  <td><Badge value={n.result} /></td>
                  <td className="max-w-xs text-ink-300">{n.followUp ?? ""}</td>
                  <td>{canWrite && <Link className="btn-ghost btn-sm" href={`/ndt?edit=${n.id}${projectId ? `&projectId=${projectId}` : ""}`}>Edit</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && editing && (
        <Card title={`Edit ${editing.code}`} actions={<Link className="btn-ghost btn-sm" href="/ndt">Close</Link>}>
          <ActionForm action={saveNdtAction.bind(null, editing.id)} submit="Save changes"><Fields cols={3} fields={fields(editing)} /></ActionForm>
        </Card>
      )}
      {canWrite && !editing && (
        <Card title="Request / record NDT">
          <ActionForm action={saveNdtAction.bind(null, null)} submit="Save NDT record" resetOnSuccess>
            <Fields cols={3} fields={fields()} />
            <p className="text-xs text-ink-400">Recording Accept/Reject requires the report number. A linked weld&apos;s status updates automatically from its NDT results.</p>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
