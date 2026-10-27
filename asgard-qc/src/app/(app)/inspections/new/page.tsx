import { InspectionType } from "@prisma/client";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, Hidden } from "@/components/fields";
import { ChecklistEditor, type ChecklistRow } from "@/components/inspections/ChecklistEditor";
import { Card, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { FABRICATION_OPERATIONS, INSPECTION_TYPE_LABELS } from "@/lib/domain/constants";
import { projectOptions, unitOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { getSetting } from "@/lib/settings";
import { createInspectionAction } from "../actions";
import { redirect } from "next/navigation";

export const metadata = { title: "Record inspection" };

export default async function NewInspection({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  if (!actor.permissions.has("inspection.write") && !actor.permissions.has("fabrication.write")) redirect("/forbidden");
  const sp = await searchParams;
  const reinspectionOf = str(sp, "reinspectionOf");
  const original = reinspectionOf ? await db.inspection.findUnique({ where: { id: reinspectionOf }, include: { items: { orderBy: { order: "asc" } } } }) : null;
  const projectId = original?.projectId ?? str(sp, "projectId");
  const unitId = original?.unitId ?? str(sp, "unitId");
  const type = original?.type ?? enumParam(sp, "type", Object.values(InspectionType));
  const [projects, units, templates, vocab] = await Promise.all([
    projectOptions(),
    unitOptions(projectId),
    db.checklistTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSetting("vocabulary"),
  ]);
  const onlyFab = !actor.permissions.has("inspection.write");
  const typeOptions = Object.entries(INSPECTION_TYPE_LABELS)
    .filter(([v]) => !onlyFab || v === "FABRICATION" || v === "DIMENSIONAL")
    .map(([value, label]) => ({ value, label }));
  const initial: ChecklistRow[] = original
    ? original.items.map((i) => ({ description: i.description, requirement: i.requirement, tolerance: i.tolerance, unit: i.unit, required: i.required, result: "PENDING", actual: "", notes: "" }))
    : [];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={original ? `Re-inspection of ${original.code}` : "Record inspection"}
        subtitle={original ? "The new record is linked to the original. Only first-attempt inspections count toward first-pass yield." : "Create the record, then complete the checklist and submit it for review."}
        actions={<Link className="btn-ghost" href="/inspections">Back to register</Link>}
      />
      <Card>
        <ActionForm action={createInspectionAction} submit="Create inspection">
          <Hidden name="reinspectionOfId" value={original?.id} />
          <Fields
            fields={[
              { name: "projectId", label: "Project", type: "select", options: projects, required: true, defaultValue: projectId, hint: projectId ? undefined : "Choose a project; frames for other projects are rejected." },
              { name: "unitId", label: "Frame / module", type: "select", options: units, defaultValue: unitId },
              { name: "type", label: "Inspection type", type: "select", options: typeOptions, required: true, defaultValue: type },
              { name: "operation", label: "Fabrication operation", type: "select", options: [...FABRICATION_OPERATIONS], defaultValue: original?.operation, hint: "For fabrication records." },
              { name: "stage", label: "Production stage", type: "select", options: vocab.productionStages, defaultValue: original?.stage },
              { name: "componentRef", label: "Component reference", defaultValue: original?.componentRef },
              { name: "drawingRef", label: "Drawing & revision", defaultValue: original?.drawingRef },
              { name: "criteriaRef", label: "Procedure / acceptance criteria reference", defaultValue: original?.criteriaRef, hint: "Reference to the approved document. Leave blank if not yet configured." },
              { name: "plannedDate", label: "Planned date", type: "date" },
              { name: "inspectedAt", label: "Inspected at", type: "datetime", hint: "Leave blank for a planned inspection." },
              { name: "inspectorName", label: "Inspector", defaultValue: actor.name },
              {
                name: "templateId",
                label: "Checklist template",
                type: "select",
                options: templates.map((t) => ({ value: t.id, label: `${t.name} — ${INSPECTION_TYPE_LABELS[t.inspectionType]}${t.approved ? "" : " (NOT APPROVED)"}` })),
                allowEmpty: templates.length ? "None" : "No templates configured",
                hint: "Template items are copied in; later template edits never change this record.",
              },
              { name: "comments", label: "Comments", type: "textarea", span: 2 },
            ]}
          />
          <div>
            <div className="label">Checklist items {original && "(copied from the original, results cleared)"}</div>
            <ChecklistEditor initial={initial} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
