import { FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterSelect } from "@/components/fields";
import { BeforeAfter } from "@/components/ncr/Thumbs";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectOptions, unitOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { listRework, OPEN_NCR } from "@/lib/services/ncrs";
import { reinspectAction, recordReworkAction } from "./actions";

export const metadata = { title: "Rework & Repairs" };

const money = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Rework({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const pendingOnly = str(sp, "pending") === "1";
  const [rows, projects, units, ncrs] = await Promise.all([
    listRework(actor, { projectId, pendingOnly }),
    projectOptions(),
    unitOptions(projectId),
    db.ncr.findMany({ where: { status: { in: OPEN_NCR }, ...(projectId ? { projectId } : {}) }, orderBy: { code: "desc" }, select: { id: true, code: true, project: { select: { code: true } } } }),
  ]);
  const actual = rows.filter((r) => r.cost != null && !r.costIsEstimate);
  const est = rows.filter((r) => r.cost != null && r.costIsEstimate);
  const sum = (xs: typeof rows) => xs.reduce((s, r) => s + Number(r.cost), 0);
  const hours = rows.reduce((s, r) => s + (r.hours != null ? Number(r.hours) : 0), 0);
  const canWrite = actor.permissions.has("rework.write");
  const canReinspect = actor.permissions.has("inspection.write");

  return (
    <div>
      <PageHeader
        title="Rework & Repair Tracking"
        subtitle="Repairs, rework hours and cost, re-inspection results and before/after evidence."
        actions={actor.permissions.has("export.excel") && (
          <a className="btn-secondary" href={`/api/export/rework${projectId ? `?projectId=${projectId}` : ""}`}><FileDown className="h-4 w-4" /> Excel</a>
        )}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Repair records" value={rows.length} />
        <Stat label="Awaiting re-inspection" value={rows.filter((r) => r.reinspectionResult === "PENDING").length} tone="warn" href="/rework?pending=1" />
        <Stat label="Hours recorded" value={hours ? hours.toFixed(1) : "—"} />
        <Stat label="Actual cost" value={actual.length ? money(sum(actual)) : "—"} sub={`${actual.length} record(s) with actual cost`} />
        <Stat label="Estimated cost" value={est.length ? money(sum(est)) : "—"} sub="Estimates, reported separately" tone={est.length ? "warn" : undefined} />
      </div>
      <p className="mb-4 text-xs text-ink-300">Cost is reported only where someone entered it. Records without a cost are never estimated by the system.</p>

      {canWrite && (
        <Card title="Record rework / repair" className="mb-5">
          <details open={str(sp, "new") === "1"}>
            <summary className="cursor-pointer text-sm text-ink-200">New repair record</summary>
            <div className="mt-3">
              <ActionForm action={recordReworkAction} submit="Record repair" resetOnSuccess>
                <Fields
                  cols={3}
                  fields={[
                    { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: projectId },
                    { name: "unitId", label: "Module / frame", type: "select", options: units, defaultValue: str(sp, "unitId") },
                    { name: "ncrId", label: "Linked NCR", type: "select", options: ncrs.map((n) => ({ value: n.id, label: `${n.code} (${n.project.code})` })), defaultValue: str(sp, "ncrId") },
                    { name: "description", label: "What was repaired", type: "textarea", required: true, span: 3 },
                    { name: "method", label: "Repair method", hint: "As approved in the NCR disposition." },
                    { name: "performedBy", label: "Performed by" },
                    { name: "performedAt", label: "Performed", type: "datetime" },
                    { name: "hours", label: "Hours (actual)", type: "number", step: "0.25" },
                    { name: "cost", label: "Cost", type: "number", step: "0.01" },
                    { name: "costIsEstimate", label: "Cost is an estimate", type: "checkbox" },
                    { name: "notes", label: "Notes", type: "textarea", span: 3 },
                  ]}
                />
                <p className="text-xs text-ink-300">Weld repairs are recorded from the weld record so the weld status and re-inspection stay linked. Add before/after photos from Photo Evidence with rework phase set.</p>
              </ActionForm>
            </div>
          </details>
        </Card>
      )}

      <FilterBar reset="/rework">
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="pending" label="Re-inspection" options={[{ value: "1", label: "Awaiting re-inspection" }]} value={pendingOnly ? "1" : null} empty="Any" />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty title="No repair records." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card card-pad">
              <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-100">{r.code}</span>
                    <DemoTag show={r.isDemo} />
                    <span className="text-sm text-ink-300">{r.project.code}{r.unit ? ` / ${r.unit.ref}` : ""}</span>
                    {r.ncr && <Link className="link text-sm" href={`/ncr/${r.ncr.id}`}>{r.ncr.code}</Link>}
                    {r.weld && <Link className="link text-sm" href={`/welding/${r.weld.id}`}>Weld {r.weld.weldRef}</Link>}
                    <Badge value={r.reinspectionResult} label={`Re-inspection: ${r.reinspectionResult.toLowerCase()}`} />
                  </div>
                  <p className="mt-1 text-sm text-ink-100">{r.description}</p>
                  <p className="mt-1 text-xs text-ink-300">
                    {r.method ? `Method: ${r.method} · ` : ""}Performed {fmtDate(r.performedAt)}{r.performedBy ? ` by ${r.performedBy}` : ""} · Hours {r.hours != null ? String(r.hours) : "—"} · Cost{" "}
                    {r.cost != null ? `${money(Number(r.cost))}${r.costIsEstimate ? " (estimate)" : " (actual)"}` : "not recorded"}
                    {r.reinspectedBy ? ` · Re-inspected by ${r.reinspectedBy} ${fmtDate(r.reinspectedAt)}` : ""}
                  </p>
                  {r.photos.length > 0 && <div className="mt-3"><BeforeAfter photos={r.photos} /></div>}
                </div>
                <div className="shrink-0 lg:w-72">
                  {r.weld ? (
                    <Link className="btn-secondary btn-sm" href={`/welding/${r.weld.id}`}>Re-inspect from weld record</Link>
                  ) : canReinspect ? (
                    <ActionForm action={reinspectAction.bind(null, r.id)} submit="Record re-inspection" submitClass="btn-secondary btn-sm">
                      <select name="result" required className="input py-1.5 text-xs" defaultValue="">
                        <option value="" disabled>Re-inspection result…</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="HOLD">Hold</option>
                        <option value="NA">Not applicable</option>
                      </select>
                      <input name="notes" placeholder="Notes" className="input py-1.5 text-xs" />
                    </ActionForm>
                  ) : null}
                  {canWrite && (
                    <Link className="link mt-2 block text-xs" href={`/photos?upload=1&projectId=${encodeURIComponent(r.projectId)}&repairId=${r.id}`}>Add before/after photos</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
