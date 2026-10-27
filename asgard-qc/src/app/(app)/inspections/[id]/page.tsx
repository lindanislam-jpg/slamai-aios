import { Camera, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { ChecklistEditor } from "@/components/inspections/ChecklistEditor";
import { Badge, Card, DemoTag, fmtDate, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { FABRICATION_OPERATIONS, humanize, INSPECTION_TYPE_LABELS, RESULT_LABELS } from "@/lib/domain/constants";
import { getInspection, submissionProblems } from "@/lib/services/inspections";
import { getSetting } from "@/lib/settings";
import { cancelInspectionAction, reviewInspectionAction, saveChecklistAction, submitInspectionAction, updateInspectionAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Inspection ${(await params).id.slice(0, 6)}` };
}

export default async function InspectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const [{ insp, history }, vocab] = await Promise.all([getInspection(actor, id), getSetting("vocabulary")]);
  const p = actor.permissions;
  const canWrite = p.has("inspection.write") || ((insp.type === "FABRICATION" || insp.type === "DIMENSIONAL") && p.has("fabrication.write"));
  const editable = insp.status === "DRAFT" && canWrite;
  const problems = insp.status === "DRAFT" ? submissionProblems(insp) : [];
  const canReview = p.has("inspection.review") && (insp.status === "SUBMITTED" || insp.status === "REVIEWED");
  const ownRecord = insp.inspectorId === actor.id && actor.role !== "ADMIN";
  const unconfigured = insp.items.filter((i) => i.criteriaStatus === "REQUIRES_CONFIGURATION").length;
  const q = (o: Record<string, string | null | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${insp.code} · ${INSPECTION_TYPE_LABELS[insp.type]}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="link" href={`/projects/${insp.project.id}`}>{insp.project.code} {insp.project.name}</Link>
            {insp.unit && <span>· {insp.unit.ref}</span>}
            <Badge value={insp.result} label={`Result: ${RESULT_LABELS[insp.result]}`} />
            <Badge value={insp.status} />
            <DemoTag show={insp.isDemo} />
          </span>
        }
        actions={
          <>
            {canWrite && insp.status !== "CANCELLED" && (
              <Link className="btn-secondary" href={`/inspections/new?${q({ reinspectionOf: insp.id, projectId: insp.projectId, unitId: insp.unitId, type: insp.type })}`}>
                <RotateCcw className="h-4 w-4" /> Create re-inspection
              </Link>
            )}
            {p.has("ncr.raise") && (
              <Link className="btn-secondary" href={`/ncr/new?${q({ projectId: insp.projectId, unitId: insp.unitId, inspectionId: insp.id })}`}>
                <TriangleAlert className="h-4 w-4" /> Raise NCR
              </Link>
            )}
            {p.has("photo.upload") && (
              <Link className="btn-secondary" href={`/photos?${q({ upload: "1", projectId: insp.projectId, unitId: insp.unitId, inspectionId: insp.id })}`}>
                <Camera className="h-4 w-4" /> Add photos
              </Link>
            )}
          </>
        }
      />

      {problems.length > 0 && (
        <div className="rounded-lg border border-warn-600/50 bg-warn-600/10 px-4 py-3 text-sm text-warn-400">
          <div className="font-semibold">Before this can be submitted:</div>
          <ul className="mt-1 list-disc pl-5">{problems.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card title="Details">
            <KV
              cols={3}
              items={[
                ["Operation", insp.operation],
                ["Stage", insp.stage],
                ["Component", insp.componentRef],
                ["Drawing", insp.drawingRef],
                ["Planned", fmtDate(insp.plannedDate)],
                ["Inspected", fmtDateTime(insp.inspectedAt)],
                ["Inspector", insp.inspectorName],
                ["Criteria reference", insp.criteriaRef ?? "Not recorded"],
                ["Reviewer", insp.reviewerName ? `${insp.reviewerName} · ${fmtDateTime(insp.reviewedAt)}` : "Not reviewed"],
                ["Comments", insp.comments],
              ]}
            />
          </Card>

          <Card title={`Checklist (${insp.items.length})`} actions={unconfigured > 0 ? <Badge tone="warn" label={`${unconfigured} require configuration`} /> : undefined}>
            {editable ? (
              <ActionForm action={saveChecklistAction.bind(null, insp.id)} submit="Save checklist">
                <ChecklistEditor initial={insp.items.map((i) => ({ description: i.description, requirement: i.requirement, tolerance: i.tolerance, actual: i.actual, unit: i.unit, result: i.result, notes: i.notes, required: i.required }))} />
              </ActionForm>
            ) : insp.items.length === 0 ? (
              <p className="text-sm text-ink-300">No checklist items recorded.</p>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>#</th><th>Check</th><th>Requirement</th><th>Tolerance</th><th>Actual</th><th>Result</th><th>Notes</th></tr></thead>
                  <tbody>
                    {insp.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.order}</td>
                        <td>{i.description}{!i.required && <span className="ml-1 text-xs text-ink-400">(optional)</span>}</td>
                        <td>{i.requirement ?? <Badge value="REQUIRES_CONFIGURATION" />}</td>
                        <td>{i.tolerance ?? "—"}</td>
                        <td>{i.actual ?? "—"}{i.unit ? ` ${i.unit}` : ""}</td>
                        <td><Badge value={i.result} label={RESULT_LABELS[i.result]} /></td>
                        <td className="text-ink-300">{i.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-ink-400">Items without a requirement are flagged “Requires configuration”. Acceptance criteria come from approved documents and are never filled in by the system.</p>
          </Card>

          {editable && (
            <Card title="Record result">
              <ActionForm action={updateInspectionAction.bind(null, insp.id)} submit="Save details">
                <Fields
                  fields={[
                    { name: "result", label: "Overall result", type: "select", options: Object.entries(RESULT_LABELS).map(([value, label]) => ({ value, label })), defaultValue: insp.result, allowEmpty: false },
                    { name: "inspectedAt", label: "Inspected at", type: "datetime", defaultValue: insp.inspectedAt },
                    { name: "inspectorName", label: "Inspector", defaultValue: insp.inspectorName },
                    { name: "criteriaRef", label: "Criteria reference", defaultValue: insp.criteriaRef },
                    { name: "operation", label: "Operation", type: "select", options: [...FABRICATION_OPERATIONS], defaultValue: insp.operation },
                    { name: "stage", label: "Stage", type: "select", options: vocab.productionStages, defaultValue: insp.stage },
                    { name: "componentRef", label: "Component", defaultValue: insp.componentRef },
                    { name: "drawingRef", label: "Drawing", defaultValue: insp.drawingRef },
                    { name: "plannedDate", label: "Planned date", type: "date", defaultValue: insp.plannedDate },
                    { name: "comments", label: "Comments", type: "textarea", span: 2, defaultValue: insp.comments },
                  ]}
                />
              </ActionForm>
              <div className="mt-4 border-t border-ink-600 pt-4">
                <ActionForm action={submitInspectionAction.bind(null, insp.id)} submit="Submit for review" submitClass="btn-ok" confirm="Submit this inspection? It can no longer be edited after submission." />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {canReview && (
            <Card title="Review">
              {ownRecord ? (
                <p className="text-sm text-ink-300">You recorded this inspection. Segregation of duties: it must be reviewed by a different authorised person.</p>
              ) : (
                <ActionForm action={reviewInspectionAction.bind(null, insp.id)} submit="Record decision">
                  <Fields
                    cols={1}
                    fields={[
                      { name: "decision", label: "Decision", type: "select", required: true, options: [{ value: "ACCEPTED", label: "Accept record" }, { value: "REJECTED", label: "Reject record (return for correction)" }] },
                      { name: "note", label: "Review note", type: "textarea", hint: "Required when rejecting." },
                    ]}
                  />
                </ActionForm>
              )}
            </Card>
          )}

          <Card title="Linked records">
            <div className="space-y-3 text-sm">
              <div>
                <div className="label">NCRs</div>
                {insp.ncrs.length ? insp.ncrs.map((n) => (
                  <div key={n.id} className="flex items-center gap-2"><Link className="link" href={`/ncr/${n.id}`}>{n.code}</Link><Badge value={n.status} /><Badge value={n.priority} /></div>
                )) : <span className="text-ink-300">None</span>}
              </div>
              <div>
                <div className="label">Re-inspection chain</div>
                {insp.reinspectionOf && <div>Re-inspects <Link className="link" href={`/inspections/${insp.reinspectionOf.id}`}>{insp.reinspectionOf.code}</Link> <Badge value={insp.reinspectionOf.result} /></div>}
                {insp.reinspections.map((r) => <div key={r.id}>Re-inspected by <Link className="link" href={`/inspections/${r.id}`}>{r.code}</Link> <Badge value={r.result} /></div>)}
                {!insp.reinspectionOf && insp.reinspections.length === 0 && <span className="text-ink-300">First attempt — no re-inspections.</span>}
              </div>
            </div>
          </Card>

          <Card title={`Photos (${insp.photos.length})`}>
            {insp.photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {insp.photos.map((ph) => (
                  <Link key={ph.id} href={`/photos/${ph.id}`} className="group block overflow-hidden rounded-md border border-ink-600" title={ph.caption ?? ph.code}>
                    {ph.thumbKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/photo/${ph.id}?size=thumb`} alt={ph.caption ?? ph.code} className="aspect-square w-full object-cover transition group-hover:opacity-80" loading="lazy" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-ink-700 text-[10px] text-ink-300">No preview</div>
                    )}
                    <div className="truncate px-1 py-0.5 text-[10px] text-ink-300">{ph.code}</div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-ink-300">No photos linked.</p>}
          </Card>

          {p.has("inspection.review") && insp.status !== "ACCEPTED" && insp.status !== "CANCELLED" && (
            <Card title="Cancel record">
              <ActionForm action={cancelInspectionAction.bind(null, insp.id)} submit="Cancel inspection" submitClass="btn-danger" confirm="Cancel this inspection record? It will be excluded from KPIs.">
                <Fields cols={1} fields={[{ name: "reason", label: "Reason", type: "textarea", required: true }]} />
              </ActionForm>
            </Card>
          )}

          <Card title="History">
            <History events={history} />
          </Card>
          <p className="text-xs text-ink-400">Type: {humanize(insp.type)} · created {fmtDateTime(insp.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
