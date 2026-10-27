import { InspectionResult, InspectionType, RecordStatus } from "@prisma/client";
import { FileDown, Plus } from "lucide-react";
import Link from "next/link";
import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Badge, DemoTag, Empty, fmtDate, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { humanize, INSPECTION_TYPE_LABELS } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { dateParam, enumParam, str, type SP } from "@/lib/params";
import { listInspections } from "@/lib/services/inspections";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Inspection Register" };

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const filter = {
    projectId,
    unitId: str(sp, "unitId"),
    type: enumParam(sp, "type", Object.values(InspectionType)),
    result: enumParam(sp, "result", Object.values(InspectionResult)),
    status: enumParam(sp, "status", Object.values(RecordStatus)),
    inspector: str(sp, "inspector"),
    stage: str(sp, "stage"),
    from: dateParam(sp, "from"),
    to: dateParam(sp, "to", true),
    q: str(sp, "q"),
    overdue: str(sp, "overdue") === "1",
  };
  const [rows, projects, units, vocab] = await Promise.all([listInspections(actor, filter), projectOptions(), unitOptions(projectId), getSetting("vocabulary")]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const canWrite = actor.permissions.has("inspection.write") || actor.permissions.has("fabrication.write");

  return (
    <div>
      <PageHeader
        title="Inspection Register"
        subtitle={filter.overdue ? "Showing overdue inspections: not completed and past their planned date." : "Every inspection, with result, record status and reviewer."}
        actions={
          <>
            {actor.permissions.has("export.excel") && (
              <a className="btn-secondary" href={`/api/export/inspections?${qs}`}>
                <FileDown className="h-4 w-4" /> Excel
              </a>
            )}
            {canWrite && (
              <Link className="btn-primary" href={`/inspections/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Plus className="h-4 w-4" /> Record inspection
              </Link>
            )}
          </>
        }
      />
      <FilterBar reset="/inspections">
        <FilterInput name="q" label="Search" value={filter.q} placeholder="ID, component, drawing, frame" />
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
        <FilterSelect name="unitId" label="Frame / module" options={units} value={filter.unitId} />
        <FilterSelect name="type" label="Type" options={Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} value={filter.type} />
        <FilterSelect name="stage" label="Stage" options={vocab.productionStages} value={filter.stage} />
        <FilterSelect name="result" label="Result" options={Object.values(InspectionResult).map((v) => ({ value: v, label: humanize(v) }))} value={filter.result} />
        <FilterSelect name="status" label="Record status" options={Object.values(RecordStatus).map((v) => ({ value: v, label: humanize(v) }))} value={filter.status} />
        <FilterInput name="inspector" label="Inspector" value={filter.inspector} />
        <FilterInput name="from" label="From" type="date" value={str(sp, "from")} />
        <FilterInput name="to" label="To" type="date" value={str(sp, "to")} />
        <FilterSelect name="overdue" label="Overdue" options={[{ value: "1", label: "Overdue only" }]} value={filter.overdue ? "1" : null} empty="Any" />
      </FilterBar>

      {rows.length === 0 ? (
        <Empty title="No inspections match these filters">{canWrite && <Link className="link" href="/inspections/new">Record the first inspection</Link>}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th><th>Project</th><th>Frame</th><th>Type</th><th>Stage</th><th>Planned</th><th>Inspected</th><th>Inspector</th><th>Result</th><th>Record</th><th>Items</th><th>Photos</th><th>NCRs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const overdue = (i.status === "DRAFT" || i.status === "REJECTED") && i.plannedDate && i.plannedDate < new Date();
                return (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap">
                      <Link className="link font-medium" href={`/inspections/${i.id}`}>{i.code}</Link> <DemoTag show={i.isDemo} />
                      {i.reinspectionOfId && <span className="ml-1 text-[11px] text-ink-300">re-insp.</span>}
                    </td>
                    <td>{i.project.code}</td>
                    <td>{i.unit?.ref ?? "—"}</td>
                    <td className="whitespace-nowrap">{INSPECTION_TYPE_LABELS[i.type]}{i.operation && <span className="block text-xs text-ink-300">{i.operation}</span>}</td>
                    <td className="text-ink-300">{i.stage ?? "—"}</td>
                    <td className={overdue ? "whitespace-nowrap text-bad-400" : "whitespace-nowrap"}>{fmtDate(i.plannedDate)}{overdue ? " · overdue" : ""}</td>
                    <td className="whitespace-nowrap">{fmtDate(i.inspectedAt)}</td>
                    <td>{i.inspectorName ?? "—"}</td>
                    <td><Badge value={i.result} /></td>
                    <td><Badge value={i.status} /></td>
                    <td className="tabular-nums">{i._count.items}</td>
                    <td className="tabular-nums">{i._count.photos}</td>
                    <td className="tabular-nums">{i._count.ncrs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-400">{rows.length} record(s){rows.length >= 200 ? " — showing the first 200; narrow the filters" : ""}.</p>
    </div>
  );
}
