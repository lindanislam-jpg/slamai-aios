import type { FieldDef } from "@/components/fields";

export function auditFields(a?: { title: string; auditType: string; scope: string | null; standardRefs: string | null; scheduledAt: Date; auditor: string | null; status: string; summary: string | null; checklist: unknown }): FieldDef[] {
  const checklist = Array.isArray(a?.checklist) ? (a!.checklist as { question: string }[]).map((c) => c.question).join("\n") : "";
  return [
    { name: "title", label: "Title", required: true, defaultValue: a?.title, span: 2 },
    { name: "auditType", label: "Audit type", type: "select", required: true, options: ["Internal process audit", "Internal system audit", "Product audit", "Supplier audit", "Customer audit", "External / certification audit"], defaultValue: a?.auditType },
    { name: "scheduledAt", label: "Scheduled date", type: "date", required: true, defaultValue: a?.scheduledAt },
    { name: "auditor", label: "Auditor", defaultValue: a?.auditor },
    ...(a ? [{ name: "status", label: "Status", type: "select" as const, allowEmpty: false, options: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"].map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() })), defaultValue: a.status }] : []),
    { name: "standardRefs", label: "Procedures / standards referenced", defaultValue: a?.standardRefs, span: 2, hint: "Reference only — not a compliance claim. Applicable standards, editions and scope must be verified by authorised personnel." },
    { name: "scope", label: "Scope", type: "textarea", defaultValue: a?.scope, span: 2 },
    { name: "checklist", label: "Checklist (one question per line)", type: "textarea", defaultValue: checklist, span: 2 },
    ...(a ? [{ name: "summary", label: "Summary", type: "textarea" as const, defaultValue: a.summary, span: 2 as const }] : []),
  ];
}
