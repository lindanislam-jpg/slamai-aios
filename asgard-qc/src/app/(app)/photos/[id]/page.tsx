import { Download } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields, type FieldDef } from "@/components/fields";
import { PhotoDate, Thumb } from "@/components/photos/Thumb";
import { Badge, Card, DemoTag, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { aiStatus, type AiSuggestion } from "@/lib/ai/vision";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { INSPECTION_TYPE_LABELS } from "@/lib/domain/constants";
import { getPhoto } from "@/lib/services/photos";
import { getSetting } from "@/lib/settings";
import { applyAiAction, reviewPhotoAction, updatePhotoAction, withdrawPhotoAction } from "../actions";
import { AiDraftButton } from "./AiDraftButton";

const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default async function PhotoDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const { photo, history } = await getPhoto(actor, id);
  const can = (p: Parameters<typeof actor.permissions.has>[0]) => actor.permissions.has(p);
  const projectId = photo.projectId;
  const [vocab, units, inspections, ncrs, welds, materials, repairs, pair] = await Promise.all([
    getSetting("vocabulary"),
    db.unit.findMany({ where: { projectId }, orderBy: { ref: "asc" }, select: { id: true, ref: true } }),
    db.inspection.findMany({ where: { projectId }, orderBy: { code: "desc" }, select: { id: true, code: true, type: true } }),
    db.ncr.findMany({ where: { projectId }, orderBy: { code: "desc" }, select: { id: true, code: true } }),
    db.weld.findMany({ where: { projectId }, orderBy: { weldRef: "asc" }, select: { id: true, weldRef: true } }),
    db.material.findMany({ where: { OR: [{ projectId }, { projectId: null }] }, orderBy: { code: "desc" }, select: { id: true, code: true, heatNumber: true } }),
    db.repair.findMany({ where: { projectId }, orderBy: { code: "desc" }, select: { id: true, code: true } }),
    photo.repairId ? db.photo.findMany({ where: { repairId: photo.repairId, deletedAt: null }, orderBy: [{ takenAt: "asc" }, { uploadedAt: "asc" }] }) : Promise.resolve([]),
  ]);
  const ai = photo.aiSuggestion as AiSuggestion | null;
  const status = aiStatus();
  const opt = (rows: { id: string }[], label: (r: never) => string) => rows.map((r) => ({ value: r.id, label: label(r as never) }));
  const categories = vocab.photoCategories.includes(photo.category) ? vocab.photoCategories : [photo.category, ...vocab.photoCategories];

  const editFields: FieldDef[] = [
    { name: "category", label: "Category", type: "select", options: categories, required: true, allowEmpty: false, defaultValue: photo.category },
    { name: "stage", label: "Production stage", type: "select", options: vocab.productionStages, defaultValue: photo.stage },
    { name: "unitId", label: "Module / frame", type: "select", options: opt(units, (u: { ref: string }) => u.ref), defaultValue: photo.unitId },
    { name: "componentRef", label: "Component / drawing ref", defaultValue: photo.componentRef },
    { name: "inspectionType", label: "Inspection type", type: "select", options: Object.values(INSPECTION_TYPE_LABELS), defaultValue: photo.inspectionType },
    { name: "responsiblePerson", label: "Inspector / responsible person", defaultValue: photo.responsiblePerson },
    { name: "heatNumber", label: "Heat number", defaultValue: photo.heatNumber },
    { name: "weldRef", label: "Weld reference", defaultValue: photo.weldRef },
    { name: "inspectionId", label: "Linked inspection", type: "select", options: opt(inspections, (i: { code: string; type: string }) => `${i.code} ${INSPECTION_TYPE_LABELS[i.type]}`), defaultValue: photo.inspectionId },
    { name: "ncrId", label: "Linked NCR", type: "select", options: opt(ncrs, (n: { code: string }) => n.code), defaultValue: photo.ncrId },
    { name: "weldId", label: "Linked weld", type: "select", options: opt(welds, (w: { weldRef: string }) => w.weldRef), defaultValue: photo.weldId },
    { name: "materialId", label: "Linked material", type: "select", options: opt(materials, (m: { code: string; heatNumber: string | null }) => `${m.code}${m.heatNumber ? ` · ${m.heatNumber}` : ""}`), defaultValue: photo.materialId },
    { name: "repairId", label: "Linked repair", type: "select", options: opt(repairs, (r: { code: string }) => r.code), defaultValue: photo.repairId },
    { name: "reworkPhase", label: "Rework phase", type: "select", options: [{ value: "BEFORE", label: "Before repair" }, { value: "AFTER", label: "After repair" }], defaultValue: photo.reworkPhase },
    { name: "tags", label: "Tags (comma separated)", defaultValue: photo.tags.join(", "), span: 2 },
    { name: "caption", label: "Caption", defaultValue: photo.caption, span: 2 },
    { name: "description", label: "Description", type: "textarea", defaultValue: photo.description, span: 2 },
    { name: "observedCondition", label: "Observed condition", type: "textarea", defaultValue: photo.observedCondition },
    { name: "correctiveAction", label: "Related corrective action", type: "textarea", defaultValue: photo.correctiveAction },
  ];
  const locked = photo.reviewStatus === "APPROVED" && !can("photo.review");

  return (
    <div>
      <PageHeader
        title={`${photo.code} — ${photo.caption ?? photo.category}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={photo.reviewStatus} /> <DemoTag show={photo.isDemo} /> {photo.deletedAt && <Badge tone="bad" label="WITHDRAWN" />}
            <Link className="link" href={`/projects/${photo.project.id}?tab=photos`}>{photo.project.code} {photo.project.name}</Link>
          </span>
        }
        actions={can("photo.download") && <a className="btn-secondary" href={`/api/files/photo/${photo.id}`}><Download className="h-4 w-4" />Original</a>}
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card pad={false}>
            {photo.thumbKey && can("photo.download") ? (
              // Full-size original for viewers allowed to download it; thumbnails otherwise.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/photo/${photo.id}`} alt={photo.caption ?? photo.category} className="max-h-[70vh] w-full rounded-t-xl bg-ink-950 object-contain" />
            ) : (
              <Thumb id={photo.id} hasThumb={!!photo.thumbKey} alt={photo.caption ?? photo.category} className="max-h-[70vh] w-full rounded-t-xl object-contain" />
            )}
            <div className="p-4 text-sm"><PhotoDate takenAt={photo.takenAt} uploadedAt={photo.uploadedAt} /></div>
          </Card>

          {pair.length > 1 && (
            <Card title="Before and after repair">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["BEFORE", "AFTER"] as const).map((phase) => {
                  const list = pair.filter((p) => p.reworkPhase === phase);
                  return (
                    <div key={phase}>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-300">{phase === "BEFORE" ? "Before" : "After"}</div>
                      {list.length ? list.map((p) => (
                        <Link key={p.id} href={`/photos/${p.id}`} className="mb-2 block">
                          <Thumb id={p.id} hasThumb={!!p.thumbKey} alt={p.caption ?? p.code} className="aspect-[4/3] w-full rounded-lg" />
                          <div className="mt-1 text-xs text-ink-300">{p.code} · <PhotoDate takenAt={p.takenAt} uploadedAt={p.uploadedAt} /></div>
                        </Link>
                      )) : <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-ink-500 text-xs text-warn-400">No {phase.toLowerCase()} photo recorded</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card title="Evidence details">
            <KV
              items={[
                ["Evidence ID", photo.code],
                ["Project", `${photo.project.code} — ${photo.project.name}`],
                ["Module / frame", photo.unit?.ref],
                ["Component / drawing", photo.componentRef],
                ["Category", photo.category],
                ["Production stage", photo.stage],
                ["Inspection type", photo.inspectionType],
                ["Capture time (from file)", photo.takenAt ? fmtDateTime(photo.takenAt) : "Not present in file"],
                ["Uploaded", `${fmtDateTime(photo.uploadedAt)} by ${photo.uploadedByName ?? "—"}`],
                ["Inspector / responsible", photo.responsiblePerson],
                ["Heat number", photo.heatNumber],
                ["Weld reference", photo.weld?.weldRef ?? photo.weldRef],
                ["Caption", photo.caption],
                ["Description", photo.description],
                ["Observed condition", photo.observedCondition],
                ["Related corrective action", photo.correctiveAction],
                ["Tags", photo.tags.join(", ") || "—"],
                ["Review", photo.reviewedAt ? `${photo.reviewStatus.replace(/_/g, " ").toLowerCase()} · ${fmtDateTime(photo.reviewedAt)}` : "Not reviewed"],
                ["Original file", `${photo.originalName} · ${photo.mimeType} · ${kb(photo.sizeBytes)}${photo.width ? ` · ${photo.width}×${photo.height}px` : ""}`],
                ["SHA-256", <code key="sha" className="break-all text-xs text-ink-300">{photo.sha256}</code>],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {photo.inspection && <Link className="btn-secondary btn-sm" href={`/inspections/${photo.inspection.id}`}>Inspection {photo.inspection.code}</Link>}
              {photo.ncr && <Link className="btn-secondary btn-sm" href={`/ncr/${photo.ncr.id}`}>{photo.ncr.code}</Link>}
              {photo.weld && <Link className="btn-secondary btn-sm" href={`/welding/${photo.weld.id}`}>Weld {photo.weld.weldRef}</Link>}
              {photo.material && <Link className="btn-secondary btn-sm" href={`/materials/${photo.material.id}`}>Material {photo.material.code}</Link>}
              {photo.repair && <Link className="btn-secondary btn-sm" href="/rework">Repair {photo.repair.code}{photo.reworkPhase ? ` (${photo.reworkPhase.toLowerCase()})` : ""}</Link>}
              {photo.unit && <Link className="btn-secondary btn-sm" href={`/projects/${photo.project.id}?tab=overview&unit=${photo.unit.id}`}>Frame {photo.unit.ref}</Link>}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="AI-assisted review (draft only)">
            <p className="mb-3 text-xs text-ink-300">AI can suggest a caption, category and <em>possible</em> observations. It never confirms defects, measures, certifies or releases anything. Nothing is applied unless you tick it below.</p>
            {!status.configured ? (
              <p className="text-sm text-warn-400">Not configured. {status.reason}</p>
            ) : can("photo.edit") && !photo.deletedAt ? (
              <AiDraftButton photoId={photo.id} again={!!ai} />
            ) : null}
            {ai && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-warn-600/60 bg-warn-600/10 px-3 py-2 text-xs font-semibold text-warn-400">{ai.disclaimer}</div>
                <KV
                  cols={2}
                  items={[
                    ["Suggested caption", ai.caption],
                    ["Suggested category", ai.category],
                    ["Description", ai.description],
                    ["Possible observations", ai.possibleObservations.length ? ai.possibleObservations.join("\n") : "None"],
                    ["Possible defect categories to check", ai.possibleDefectCategories.join(", ") || "None"],
                    ["Visible markings", ai.visibleText || "None legible"],
                    ["Image quality", ai.imageQualityNotes || "—"],
                    ["Model / generated", `${ai.model} · ${fmtDateTime(ai.generatedAt)}`],
                  ]}
                />
                {can("photo.edit") && !locked && (
                  <ActionForm action={applyAiAction.bind(null, photo.id)} submit="Apply selected to record" submitClass="btn-secondary" inline>
                    {(["caption", "description", "category", "observedCondition"] as const).map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-sm text-ink-200">
                        <input type="checkbox" name={f} className="h-4 w-4 accent-[#c39a45]" /> {f === "observedCondition" ? "observations" : f}
                      </label>
                    ))}
                  </ActionForm>
                )}
              </div>
            )}
          </Card>

          {can("photo.review") && !photo.deletedAt && (
            <Card title="Evidence review">
              <ActionForm action={reviewPhotoAction.bind(null, photo.id)} submit="Record review">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="rv-status">Decision</label>
                    <select id="rv-status" name="status" className="input" defaultValue="APPROVED">
                      <option value="REVIEWED">Reviewed</option>
                      <option value="APPROVED">Approved as evidence</option>
                      <option value="REJECTED">Rejected (unsuitable)</option>
                      <option value="PENDING_REVIEW">Back to pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="rv-note">Note</label>
                    <input id="rv-note" name="note" className="input" placeholder="Required when rejecting" />
                  </div>
                </div>
              </ActionForm>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-bad-400">Withdraw from registers…</summary>
                <div className="mt-3">
                  <ActionForm action={withdrawPhotoAction.bind(null, photo.id)} submit="Withdraw photo" submitClass="btn-danger" confirm="Withdraw this photo? The original file and record are kept for traceability.">
                    <div>
                      <label className="label" htmlFor="wd-reason">Reason</label>
                      <input id="wd-reason" name="reason" required className="input" placeholder="e.g. uploaded to wrong project" />
                    </div>
                  </ActionForm>
                </div>
              </details>
            </Card>
          )}

          {can("photo.edit") && !photo.deletedAt && (
            <Card title="Edit details">
              {locked ? (
                <p className="text-sm text-ink-300">This photo has been approved. Only a reviewer can change its details.</p>
              ) : (
                <ActionForm action={updatePhotoAction.bind(null, photo.id)} submit="Save details">
                  <Fields fields={editFields} />
                </ActionForm>
              )}
            </Card>
          )}

          <Card title="History"><History events={history} /></Card>
        </div>
      </div>
    </div>
  );
}
