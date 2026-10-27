import { InspectionResult } from "@prisma/client";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Bars } from "@/components/charts";
import { Fields, FilterBar, FilterInput, FilterSelect, Hidden } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { FABRICATION_OPERATIONS, humanize } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { dateParam, enumParam, str, type SP } from "@/lib/params";
import { listInspections } from "@/lib/services/inspections";
import { createInspectionAction } from "../inspections/actions";

export const metadata = { title: "Fabrication QC" };

export default async function FabricationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const operation = str(sp, "operation");
  const all = await listInspections(actor, {
    projectId,
    unitId: str(sp, "unitId"),
    type: ["FABRICATION", "DIMENSIONAL"],
    result: enumParam(sp, "result", Object.values(InspectionResult)),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to", true),
    q: str(sp, "q"),
  });
  const opKey = (r: (typeof all)[number]) => r.operation ?? (r.type === "DIMENSIONAL" ? "Dimensional check" : "Not specified");
  const rows = operation ? all.filter((r) => opKey(r) === operation) : all;
  const [projects, units] = await Promise.all([projectOptions(), unitOptions(projectId)]);
  const canWrite = actor.permissions.has("fabrication.write") || actor.permissions.has("inspection.write");

  const byOp = new Map<string, { total: number; issues: number }>();
  for (const r of all.filter((x) => x.status !== "CANCELLED")) {
    const k = opKey(r);
    const s = byOp.get(k) ?? { total: 0, issues: 0 };
    s.total++;
    if (r.result === "FAIL" || r.result === "HOLD") s.issues++;
    byOp.set(k, s);
  }
  const opStats = [...byOp.entries()].sort((a, b) => b[1].total - a[1].total);
  const issues = all.filter((r) => r.status !== "CANCELLED" && (r.result === "FAIL" || r.result === "HOLD")).length;
  const pending = all.filter((r) => r.status === "DRAFT").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Fabrication QC" subtitle="Cutting, drilling, bending, fit-up, dimensional and workmanship checks. Records are inspections of type Fabrication or Dimensional." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fabrication & dimensional records" value={all.length} />
        <Stat label="Fail / hold results" value={issues} tone={issues ? "bad" : undefined} />
        <Stat label="Drafts awaiting result" value={pending} tone={pending ? "warn" : undefined} />
        <Stat label="Operations covered" value={opStats.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Fail / hold by operation">
          <Bars data={opStats.map(([key, s]) => ({ key, count: s.issues }))} color="#e5484d" />
          <div className="mt-3 table-wrap">
            <table className="tbl">
              <thead><tr><th>Operation</th><th>Records</th><th>Fail / hold</th></tr></thead>
              <tbody>
                {opStats.map(([k, s]) => (
                  <tr key={k}><td><Link className="link" href={`/fabrication?operation=${encodeURIComponent(k)}`}>{k}</Link></td><td>{s.total}</td><td className={s.issues ? "text-bad-400" : ""}>{s.issues}</td></tr>
                ))}
                {opStats.length === 0 && <tr><td colSpan={3} className="text-ink-300">No records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        {canWrite && (
          <Card title="New fabrication check">
            <ActionForm action={createInspectionAction} submit="Create and open checklist">
              <Hidden name="stage" value="Fabrication" />
              <Fields
                fields={[
                  { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: projectId },
                  { name: "unitId", label: "Frame / module", type: "select", options: units },
                  { name: "type", label: "Type", type: "select", options: [{ value: "FABRICATION", label: "Fabrication" }, { value: "DIMENSIONAL", label: "Dimensional" }], required: true, defaultValue: "FABRICATION", allowEmpty: false },
                  { name: "operation", label: "Operation", type: "select", options: [...FABRICATION_OPERATIONS], required: true },
                  { name: "componentRef", label: "Component reference" },
                  { name: "drawingRef", label: "Drawing & revision" },
                  { name: "criteriaRef", label: "Acceptance criteria reference", span: 2, hint: "Cite the approved drawing/procedure. Tolerances are entered per checklist item; none are assumed." },
                ]}
              />
            </ActionForm>
          </Card>
        )}
      </div>

      <FilterBar reset="/fabrication">
        <FilterInput name="q" label="Search" value={str(sp, "q")} placeholder="ID, component, drawing" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="unitId" label="Frame" options={units} value={str(sp, "unitId")} />
        <FilterSelect name="operation" label="Operation" options={[...FABRICATION_OPERATIONS]} value={operation} />
        <FilterSelect name="result" label="Result" options={Object.values(InspectionResult).map((v) => ({ value: v, label: humanize(v) }))} value={str(sp, "result")} />
        <FilterInput name="from" label="From" type="date" value={str(sp, "from")} />
        <FilterInput name="to" label="To" type="date" value={str(sp, "to")} />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty title="No fabrication records match" />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Project</th><th>Frame</th><th>Type</th><th>Operation</th><th>Component / drawing</th><th>Inspected</th><th>Inspector</th><th>Items</th><th>Result</th><th>Record</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap"><Link className="link" href={`/inspections/${i.id}`}>{i.code}</Link> <DemoTag show={i.isDemo} /></td>
                  <td>{i.project.code}</td>
                  <td>{i.unit?.ref ?? "—"}</td>
                  <td>{humanize(i.type)}</td>
                  <td>{i.operation ?? "—"}</td>
                  <td className="text-ink-300">{[i.componentRef, i.drawingRef].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="whitespace-nowrap">{fmtDate(i.inspectedAt)}</td>
                  <td>{i.inspectorName ?? "—"}</td>
                  <td>{i._count.items}</td>
                  <td><Badge value={i.result} /></td>
                  <td><Badge value={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
