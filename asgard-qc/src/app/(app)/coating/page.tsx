import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterSelect, type FieldDef } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDate, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { RESULT_LABELS } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { listCoatings } from "@/lib/services/ndt-coating";
import { saveCoatingAction } from "../ndt/actions";

export const metadata = { title: "Painting & Coating QC" };

export default async function CoatingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const editId = str(sp, "edit");
  const [rows, projects, units, editing] = await Promise.all([
    listCoatings(actor, { projectId }),
    projectOptions(),
    unitOptions(projectId),
    editId ? db.coatingRecord.findUnique({ where: { id: editId } }) : null,
  ]);
  const canWrite = actor.permissions.has("coating.write");
  const fields = (r?: typeof editing): FieldDef[] => [
    { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: r?.projectId ?? projectId },
    { name: "unitId", label: "Frame / module", type: "select", options: units, defaultValue: r?.unitId },
    { name: "surfacePrep", label: "Surface preparation", defaultValue: r?.surfacePrep },
    { name: "product", label: "Coating product", defaultValue: r?.product },
    { name: "batchRef", label: "Batch reference", defaultValue: r?.batchRef },
    { name: "specRef", label: "Specification / acceptance reference", defaultValue: r?.specRef, hint: "Required before recording Pass or Fail." },
    { name: "envReadings", label: "Environmental readings (as recorded)", type: "textarea", defaultValue: r?.envReadings, hint: "e.g. air/steel temperature, RH, dew point — when required." },
    { name: "dftReadings", label: "Dry film thickness readings (as measured)", type: "textarea", defaultValue: r?.dftReadings },
    { name: "result", label: "Result", type: "select", allowEmpty: false, options: Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label })), defaultValue: r?.result ?? "PENDING" },
    { name: "inspectedAt", label: "Inspected at", type: "datetime", defaultValue: r?.inspectedAt },
    { name: "inspectorName", label: "Inspector", defaultValue: r?.inspectorName ?? actor.name },
    { name: "notes", label: "Notes / repairs and re-inspection", type: "textarea", defaultValue: r?.notes },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Painting & Coating QC" subtitle="Surface preparation, product/batch, environmental and DFT readings. Readings are stored exactly as recorded; acceptance comes from the cited specification." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Coating records" value={rows.length} />
        <Stat label="Passed" value={rows.filter((r) => r.result === "PASS").length} tone="ok" />
        <Stat label="Fail / hold" value={rows.filter((r) => r.result === "FAIL" || r.result === "HOLD").length} tone="bad" />
        <Stat label="Pending" value={rows.filter((r) => r.result === "PENDING").length} tone="warn" />
      </div>
      <FilterBar reset="/coating">
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} />
      </FilterBar>
      {rows.length === 0 ? <Empty title="No coating records" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Ref</th><th>Project</th><th>Frame</th><th>Surface prep</th><th>Product / batch</th><th>DFT readings</th><th>Spec</th><th>Inspected</th><th>Result</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{c.code} <DemoTag show={c.isDemo} /></td>
                  <td>{c.project.code}</td>
                  <td>{c.unit?.ref ?? "—"}</td>
                  <td>{c.surfacePrep ?? "—"}</td>
                  <td>{[c.product, c.batchRef].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="max-w-xs whitespace-pre-wrap text-ink-300">{c.dftReadings ?? "—"}</td>
                  <td>{c.specRef ?? <span className="text-warn-400">not recorded</span>}</td>
                  <td className="whitespace-nowrap">{fmtDate(c.inspectedAt)}<span className="block text-xs text-ink-300">{c.inspectorName}</span></td>
                  <td><Badge value={c.result} /></td>
                  <td>{canWrite && <Link className="btn-ghost btn-sm" href={`/coating?edit=${c.id}`}>Edit</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && (
        <Card title={editing ? `Edit ${editing.code}` : "Record coating inspection"} actions={editing && <Link className="btn-ghost btn-sm" href="/coating">Close</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveCoatingAction.bind(null, editing?.id ?? null)} submit={editing ? "Save changes" : "Save record"} resetOnSuccess={!editing}>
            <Fields cols={3} fields={fields(editing)} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
