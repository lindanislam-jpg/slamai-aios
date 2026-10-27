import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Card, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { NCR_DEFECT_CATEGORIES } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { raiseNcrAction } from "../actions";

export const metadata = { title: "Raise NCR" };

export default async function NewNcr({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("ncr.raise");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const [projects, units, inspections, welds, materials] = await Promise.all([
    projectOptions(),
    unitOptions(projectId),
    db.inspection.findMany({ where: projectId ? { projectId } : {}, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, code: true, type: true, result: true } }),
    db.weld.findMany({ where: projectId ? { projectId } : {}, orderBy: { weldRef: "asc" }, take: 300, select: { id: true, weldRef: true, project: { select: { code: true } } } }),
    db.material.findMany({ where: projectId ? { OR: [{ projectId }, { projectId: null }] } : {}, orderBy: { code: "desc" }, take: 300, select: { id: true, code: true, heatNumber: true } }),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Raise non-conformance" subtitle={projectId ? "Pick a project first to narrow the frame, inspection and weld lists." : "Tip: open this form from a project, inspection or weld to pre-fill the links."} />
      {!projectId && (
        <form method="get" className="card card-pad mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px]">
            <label className="label" htmlFor="p">Narrow lists to project</label>
            <select id="p" name="projectId" className="input" defaultValue="">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <button className="btn-secondary">Narrow</button>
        </form>
      )}
      <Card>
        <ActionForm action={raiseNcrAction} submit="Raise NCR">
          <Fields
            fields={[
              { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: projectId },
              { name: "unitId", label: "Module / frame", type: "select", options: units, defaultValue: str(sp, "unitId") },
              { name: "defectCategory", label: "Defect category", type: "select", options: [...NCR_DEFECT_CATEGORIES], required: true, defaultValue: str(sp, "category") },
              { name: "priority", label: "Priority", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({ value: p, label: p.toLowerCase() })), defaultValue: "MEDIUM", allowEmpty: false },
              { name: "componentRef", label: "Component / drawing ref" },
              { name: "requirementRef", label: "Requirement / document reference", hint: "The clause, drawing or procedure the condition does not meet." },
              { name: "description", label: "Description of non-conformance", type: "textarea", required: true, span: 2 },
              { name: "containment", label: "Immediate containment", type: "textarea", span: 2, hint: "e.g. item tagged HOLD, moved to quarantine. Recording containment marks the NCR as Contained." },
              { name: "ownerName", label: "Responsible owner" },
              { name: "targetDate", label: "Target completion", type: "date" },
              { name: "inspectionId", label: "Linked inspection", type: "select", options: inspections.map((i) => ({ value: i.id, label: `${i.code} ${i.type.replace(/_/g, " ").toLowerCase()} (${i.result.toLowerCase()})` })), defaultValue: str(sp, "inspectionId") },
              { name: "weldId", label: "Linked weld", type: "select", options: welds.map((w) => ({ value: w.id, label: `${w.project.code} / ${w.weldRef}` })), defaultValue: str(sp, "weldId") },
              { name: "materialId", label: "Linked material", type: "select", options: materials.map((m) => ({ value: m.id, label: `${m.code}${m.heatNumber ? ` · heat ${m.heatNumber}` : ""}` })), defaultValue: str(sp, "materialId") },
              { name: "relatedCodes", label: "Related NCR codes", placeholder: "NCR-0003, NCR-0007", hint: "Comma-separated, for recurring issues." },
            ]}
          />
        </ActionForm>
      </Card>
    </div>
  );
}
