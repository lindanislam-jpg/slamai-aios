import Link from "next/link";
import type { CmrStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { FilterBar, FilterInput, FilterSelect, Fields } from "@/components/fields";
import { Badge, Card, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { equipmentOptions, projectOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { cmrCounts, listCmrs, OPEN_CMR } from "@/lib/services/cmrs";
import { raiseCmrAction } from "./actions";

export const metadata = { title: "Corrective Maintenance (CMR)" };

const STATUSES: CmrStatus[] = ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PARTS", "AWAITING_EXTERNAL", "AWAITING_VERIFICATION", "COMPLETED", "CLOSED", "CANCELLED"];
const label = (s: string) => s.replace(/_/g, " ").toLowerCase();

export default async function Cmrs({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const status = (str(sp, "status") ?? "open") as "open" | "closed" | CmrStatus | "all";
  const [rows, counts, equipment, projects] = await Promise.all([
    listCmrs(actor, { status: status === "all" ? null : status, equipmentId: str(sp, "equipmentId"), projectId: str(sp, "projectId"), q: str(sp, "q") }),
    cmrCounts(),
    equipmentOptions(),
    projectOptions(),
  ]);
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader title="Corrective Maintenance Requests" subtitle="Report equipment faults, record the repair, and verify the equipment before it returns to service." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open CMRs" value={counts.open} href="/cmr?status=open" />
        <Stat label="Critical / safety" value={counts.critical} tone={counts.critical ? "bad" : undefined} href="/alerts?category=CMR+%26+equipment" />
        <Stat label="Past requested date" value={counts.overdueRequested} tone={counts.overdueRequested ? "warn" : undefined} />
        <Stat label="Equipment unavailable" value={counts.unavailable} tone={counts.unavailable ? "warn" : undefined} />
      </div>

      {actor.permissions.has("cmr.raise") && (
        <Card title="Raise a CMR">
          <details>
            <summary className="cursor-pointer text-sm text-ink-200">Report an equipment problem</summary>
            <div className="mt-3">
              <ActionForm action={raiseCmrAction} submit="Raise CMR">
                <Fields
                  fields={[
                    { name: "equipmentId", label: "Equipment (register)", type: "select", options: equipment, allowEmpty: "— Not in register" },
                    { name: "assetLabel", label: "…or equipment name", placeholder: "If not in the register", hint: "Add the asset to Documents & Calibration → Equipment so repeat faults can be tracked." },
                    { name: "problem", label: "Problem description", type: "textarea", required: true, span: 2 },
                    { name: "priority", label: "Priority", type: "select", required: true, allowEmpty: false, defaultValue: "MEDIUM", options: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((v) => ({ value: v, label: label(v) })) },
                    { name: "requestedBy", label: "Response needed by", type: "date" },
                    { name: "location", label: "Location", placeholder: "Defaults to the asset's location" },
                    { name: "productionArea", label: "Production area" },
                    { name: "projectId", label: "Project affected", type: "select", options: projects },
                    { name: "productionImpact", label: "Production impact" },
                    { name: "safetyImpact", label: "Safety impact", type: "checkbox" },
                    { name: "equipmentUnavailable", label: "Equipment unavailable for production", type: "checkbox", hint: "Marks a registered asset out of service until a CMR verification returns it." },
                  ]}
                />
              </ActionForm>
            </div>
          </details>
        </Card>
      )}

      <FilterBar reset="/cmr">
        <FilterSelect name="status" label="Status" value={status} empty="Open" options={[{ value: "closed", label: "Completed / closed / cancelled" }, { value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: label(s) }))]} />
        <FilterSelect name="equipmentId" label="Equipment" value={str(sp, "equipmentId")} options={equipment} />
        <FilterSelect name="projectId" label="Project" value={str(sp, "projectId")} options={projects} />
        <FilterInput name="q" label="Search" value={str(sp, "q")} placeholder="CMR, asset, problem" />
      </FilterBar>

      <Card title={`CMRs (${rows.length})`} pad={false}>
        {rows.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>CMR</th><th>Equipment</th><th>Problem</th><th>Priority</th><th>Reported</th><th>Needed by</th><th>Assigned</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const open = (OPEN_CMR as readonly string[]).includes(c.status);
                  const late = open && c.requestedBy && c.requestedBy < now;
                  return (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap"><Link className="link font-medium" href={`/cmr/${c.id}`}>{c.code}</Link>{c.reopenCount > 0 && <span className="ml-1 text-xs text-warn-400">reopened ×{c.reopenCount}</span>}</td>
                      <td>{c.equipment ? `${c.equipment.assetNo} ${c.equipment.description}` : c.assetLabel}</td>
                      <td className="max-w-sm truncate" title={c.problem}>{c.safetyImpact && <span className="mr-1 text-bad-400">⚠ safety</span>}{c.problem}</td>
                      <td><Badge value={c.priority} /></td>
                      <td className="whitespace-nowrap">{fmtDate(c.reportedAt)}<div className="text-xs text-ink-300">{c.reportedByName}</div></td>
                      <td className={late ? "whitespace-nowrap text-bad-400" : "whitespace-nowrap"}>{fmtDate(c.requestedBy)}</td>
                      <td>{c.assignedToName ?? "—"}</td>
                      <td><Badge value={c.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No CMRs match these filters." />
        )}
      </Card>
    </div>
  );
}
