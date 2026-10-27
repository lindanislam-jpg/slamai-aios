import type { FieldDef } from "@/components/fields";

export const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_RELEASE", "CLOSED", "CANCELLED"];
const statusOpts = PROJECT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }));

type P = Partial<Record<string, unknown>> | null;

export function projectFieldDefs(p: P, opts: { withStatus: boolean }): FieldDef[] {
  const v = (k: string) => p?.[k];
  return [
    ...(p ? [] : [{ name: "code", label: "Project number", placeholder: "e.g. AMM764", hint: "Your company project number. Leave blank to get PRJ-0001 style numbering. Cannot be changed later." }]),
    { name: "name", label: "Project name", required: true, defaultValue: v("name") },
    { name: "customerRef", label: "Customer reference", defaultValue: v("customerRef"), hint: "Only if authorised for internal records." },
    ...(opts.withStatus ? [{ name: "status", label: "Status", type: "select" as const, options: statusOpts, allowEmpty: false, defaultValue: v("status"), hint: "Release is recorded from Final Inspection & Release, not here." }] : []),
    { name: "projectManager", label: "Project manager", defaultValue: v("projectManager") },
    { name: "startDate", label: "Start date", type: "date", defaultValue: v("startDate") },
    { name: "targetDate", label: "Target completion", type: "date", defaultValue: v("targetDate") },
    { name: "departments", label: "Responsible departments", defaultValue: v("departments") },
    { name: "drawingRefs", label: "Drawing & revision references", defaultValue: v("drawingRefs") },
    { name: "description", label: "Description", type: "textarea", span: 2, defaultValue: v("description") },
    { name: "scope", label: "Scope", type: "textarea", span: 2, defaultValue: v("scope") },
    { name: "requirements", label: "Applicable inspection & test requirements", type: "textarea", span: 2, defaultValue: v("requirements"), hint: "Reference the approved ITP / specification. Nothing here is treated as an acceptance criterion." },
    { name: "stages", label: "Production stages (one per line, optional)", type: "textarea", span: 2, defaultValue: Array.isArray(v("stages")) ? (v("stages") as string[]).join("\n") : "", hint: "Leave blank to use the organisation's default stages." },
  ];
}

export function unitFieldDefs(u: P, parents: { value: string; label: string }[], stages: string[]): FieldDef[] {
  const v = (k: string) => u?.[k];
  return [
    ...(u ? [] : [{ name: "ref", label: "Reference (e.g. F-1043)", required: true }]),
    { name: "type", label: "Type", type: "select", options: [{ value: "MODULE", label: "Module" }, { value: "FRAME", label: "Frame" }, { value: "COMPONENT", label: "Component" }], allowEmpty: false, defaultValue: v("type") ?? "FRAME" },
    { name: "parentId", label: "Part of", type: "select", options: parents, defaultValue: v("parentId") },
    { name: "drawingRef", label: "Drawing ref", defaultValue: v("drawingRef") },
    { name: "revision", label: "Revision", defaultValue: v("revision") },
    { name: "stage", label: "Current stage", type: "select", options: stages, defaultValue: v("stage") },
    { name: "description", label: "Description", defaultValue: v("description") },
  ];
}
