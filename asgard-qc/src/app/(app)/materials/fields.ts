import type { FieldDef } from "@/components/fields";
import { RESULT_LABELS } from "@/lib/domain/constants";

type M = Partial<{
  projectId: string | null; componentRef: string | null; description: string; grade: string | null; supplier: string | null; poRef: string | null;
  deliveryRef: string | null; heatNumber: string | null; certificateRef: string | null; quantity: unknown; unit: string | null; location: string | null;
  identificationMismatch: boolean; receivingResult: string; inspectorName: string | null; inspectedAt: Date | null;
}>;

export function materialFields(projects: { value: string; label: string }[], m: M = {}, defaultInspector?: string): FieldDef[] {
  return [
    { name: "projectId", label: "Project", type: "select", options: projects, allowEmpty: "General stock (no project)", defaultValue: m.projectId },
    { name: "description", label: "Description", required: true, defaultValue: m.description },
    { name: "grade", label: "Material grade", defaultValue: m.grade, hint: "As marked / certified. Not inferred." },
    { name: "componentRef", label: "Component", defaultValue: m.componentRef },
    { name: "supplier", label: "Supplier", defaultValue: m.supplier },
    { name: "poRef", label: "Purchase order", defaultValue: m.poRef },
    { name: "deliveryRef", label: "Delivery note", defaultValue: m.deliveryRef },
    { name: "heatNumber", label: "Heat / batch number", defaultValue: m.heatNumber },
    { name: "certificateRef", label: "Certificate reference", defaultValue: m.certificateRef, hint: "Recording a number does not verify the certificate." },
    { name: "quantity", label: "Quantity", type: "number", step: "any", defaultValue: m.quantity == null ? undefined : String(m.quantity) },
    { name: "unit", label: "Unit", defaultValue: m.unit },
    { name: "location", label: "Storage location", defaultValue: m.location },
    { name: "receivingResult", label: "Receiving inspection", type: "select", allowEmpty: false, options: Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label })), defaultValue: m.receivingResult ?? "PENDING" },
    { name: "inspectedAt", label: "Inspected at", type: "datetime", defaultValue: m.inspectedAt },
    { name: "inspectorName", label: "Inspector", defaultValue: m.inspectorName ?? defaultInspector },
    { name: "identificationMismatch", label: "Physical identification does not match documentation", type: "checkbox", defaultValue: m.identificationMismatch, span: 2 },
  ];
}
