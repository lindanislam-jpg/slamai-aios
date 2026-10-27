import { Camera, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { PhotoThumb, PhotoThumbs } from "@/components/inspections/PhotoThumbs";
import { Badge, Card, DemoTag, fmtDate, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { RESULT_LABELS, WELD_DEFECT_CATEGORIES } from "@/lib/domain/constants";
import { getWeld } from "@/lib/services/welding";
import { getSetting } from "@/lib/settings";
import { addDefectAction, confirmDefectAction, recordRepairAction, recordVisualAction, updateWeldAction } from "../actions";

export const metadata = { title: "Weld" };

export default async function WeldDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const [{ weld, history }, vocab] = await Promise.all([getWeld(actor, id), getSetting("vocabulary")]);
  const p = actor.permissions;
  const pendingRepair = weld.repairs.find((r) => r.reinspectionResult === "PENDING");
  const q = (o: Record<string, string | null | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Weld ${weld.weldRef}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="link" href={`/projects/${weld.project.id}`}>{weld.project.code} {weld.project.name}</Link>
            {weld.unit && <span>· {weld.unit.ref}</span>}
            <Badge value={weld.visualResult} label={`Visual: ${RESULT_LABELS[weld.visualResult]}`} />
            <Badge value={weld.status} />
            <DemoTag show={weld.isDemo} />
          </span>
        }
        actions={
          <>
            {p.has("ncr.raise") && <Link className="btn-secondary" href={`/ncr/new?${q({ projectId: weld.projectId, unitId: weld.unitId, weldId: weld.id })}`}><TriangleAlert className="h-4 w-4" /> Raise NCR</Link>}
            {p.has("photo.upload") && <Link className="btn-secondary" href={`/photos?${q({ upload: "1", projectId: weld.projectId, unitId: weld.unitId, weldId: weld.id })}`}><Camera className="h-4 w-4" /> Add photos</Link>}
          </>
        }
      />
      {pendingRepair && (
        <div className="rounded-lg border border-warn-600/50 bg-warn-600/10 px-4 py-3 text-sm text-warn-400">
          Repair {pendingRepair.code} is awaiting re-inspection. The next visual result is the authorised inspector&apos;s re-inspection decision and needs welding-confirm rights.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="Weld details">
            <KV cols={3} items={[
              ["Component", weld.componentRef], ["Drawing", weld.drawingRef], ["WPS", weld.wpsRef ?? "Not recorded"],
              ["Welder", weld.welderId], ["Welder qualification", weld.welderQualRef ?? "Not recorded"], ["Process", weld.process],
              ["Material", weld.materialDetails], ["Stage", weld.stage], ["NDT required", weld.ndtRequired ? "Yes" : "No"],
              ["Inspected", fmtDateTime(weld.inspectedAt)], ["Inspector", weld.inspectorName], ["Criteria reference", weld.criteriaRef ?? "Not recorded"],
              ["Notes", weld.notes],
            ]} />
          </Card>

          {p.has("weld.write") && (
            <Card title={pendingRepair ? "Record re-inspection" : "Record visual inspection"}>
              {pendingRepair && !p.has("weld.confirm") ? (
                <p className="text-sm text-ink-300">A re-inspection after repair must be recorded by an inspector with welding-confirm rights.</p>
              ) : (
                <ActionForm action={recordVisualAction.bind(null, weld.id)} submit={pendingRepair ? "Record re-inspection decision" : "Record result"}>
                  <Fields fields={[
                    { name: "visualResult", label: "Visual result", type: "select", required: true, options: [{ value: "PASS", label: "Pass" }, { value: "FAIL", label: "Fail" }, { value: "HOLD", label: "Hold" }, { value: "NA", label: "N/A" }] },
                    { name: "inspectedAt", label: "Inspected at", type: "datetime" },
                    { name: "inspectorName", label: "Inspector", defaultValue: actor.name },
                    { name: "criteriaRef", label: "Acceptance criteria reference", defaultValue: weld.criteriaRef },
                    { name: "notes", label: "Notes", type: "textarea", span: 2 },
                  ]} />
                  <p className="text-xs text-ink-400">Pass with NDT required keeps the weld awaiting NDT until an accepted report is recorded.</p>
                </ActionForm>
              )}
            </Card>
          )}

          <Card title={`Defects (${weld.defects.length})`}>
            {weld.defects.length ? (
              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead><tr><th>Category</th><th>State</th><th>Recorded</th><th>Notes</th><th></th></tr></thead>
                  <tbody>
                    {weld.defects.map((d) => (
                      <tr key={d.id}>
                        <td>{d.category}</td>
                        <td>
                          {d.confirmed ? <Badge tone="bad" label="Confirmed" /> : <Badge tone="warn" label={d.source === "AI_SUGGESTION" ? "Unconfirmed — AI suggestion" : "Unconfirmed"} />}
                          {d.confirmedAt && <span className="block text-[11px] text-ink-300">{fmtDate(d.confirmedAt)}</span>}
                        </td>
                        <td className="whitespace-nowrap">{fmtDate(d.recordedAt)}</td>
                        <td className="whitespace-pre-wrap text-ink-300">{d.notes ?? ""}</td>
                        <td>
                          {!d.confirmed && p.has("weld.confirm") && (
                            <div className="flex flex-col gap-2">
                              <ActionForm inline action={confirmDefectAction.bind(null, weld.id, d.id, true)} submit="Confirm" submitClass="btn-danger btn-sm" />
                              <ActionForm inline action={confirmDefectAction.bind(null, weld.id, d.id, false)} submit="Dismiss" submitClass="btn-secondary btn-sm" confirm="Dismiss this as not a defect? The decision is kept in history." />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mb-4 text-sm text-ink-300">No defects recorded.</p>}
            {p.has("weld.write") && (
              <ActionForm action={addDefectAction.bind(null, weld.id)} submit="Record defect" resetOnSuccess>
                <Fields fields={[
                  { name: "category", label: "Defect category", type: "select", options: [...WELD_DEFECT_CATEGORIES], required: true },
                  { name: "defectNotes", label: "Location / notes", type: "textarea" },
                ]} />
                <p className="text-xs text-ink-400">{p.has("weld.confirm") ? "Recorded by you as an authorised welding inspector, so it is confirmed." : "Will be unconfirmed until an authorised welding inspector confirms it."} Incomplete fusion/penetration should only be recorded where the relevant inspection confirms it.</p>
              </ActionForm>
            )}
          </Card>

          <Card title={`Repairs & re-inspection (${weld.repairs.length})`}>
            {weld.repairs.length === 0 && <p className="mb-3 text-sm text-ink-300">No repairs logged.</p>}
            <div className="space-y-4">
              {weld.repairs.map((r) => {
                const before = r.photos.filter((ph) => ph.reworkPhase === "BEFORE");
                const after = r.photos.filter((ph) => ph.reworkPhase === "AFTER");
                return (
                  <div key={r.id} className="rounded-lg border border-ink-600 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-ink-100">{r.code}</span>
                      <Badge value={r.reinspectionResult} label={`Re-inspection: ${RESULT_LABELS[r.reinspectionResult]}`} />
                      {r.ncrId && <span className="text-ink-300">· linked NCR</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-200">{r.description}{r.method ? ` — ${r.method}` : ""}</p>
                    <p className="text-xs text-ink-300">
                      {r.performedBy ?? "—"} · {fmtDate(r.performedAt)} · {r.hours != null ? `${r.hours} h` : "hours not recorded"} · {r.cost != null ? `cost ${r.cost}${r.costIsEstimate ? " (estimate)" : " (actual)"}` : "cost not recorded"}
                      {r.reinspectedBy && ` · re-inspected by ${r.reinspectedBy} ${fmtDate(r.reinspectedAt)}`}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div><div className="label">Before</div>{before[0] ? <PhotoThumb p={before[0]} /> : <p className="text-xs text-warn-400">No before photo</p>}</div>
                      <div><div className="label">After</div>{after[0] ? <PhotoThumb p={after[0]} /> : <p className="text-xs text-warn-400">No after photo</p>}</div>
                    </div>
                    {p.has("photo.upload") && <Link className="link mt-2 inline-block text-xs" href={`/photos?${q({ upload: "1", projectId: weld.projectId, unitId: weld.unitId, weldId: weld.id, repairId: r.id })}`}>Add before/after photos</Link>}
                  </div>
                );
              })}
            </div>
            {p.has("rework.write") && !pendingRepair && (
              <div className="mt-4 border-t border-ink-600 pt-4">
                <ActionForm action={recordRepairAction.bind(null, weld.id)} submit="Record repair">
                  <Fields fields={[
                    { name: "description", label: "Repair description", type: "textarea", required: true, span: 2 },
                    { name: "method", label: "Repair method / procedure" },
                    { name: "performedBy", label: "Performed by" },
                    { name: "performedAt", label: "Performed at", type: "datetime" },
                    { name: "hours", label: "Hours (actual, optional)", type: "number", step: "0.25" },
                    { name: "cost", label: "Cost (optional)", type: "number", step: "0.01" },
                    { name: "costIsEstimate", label: "Cost is an estimate", type: "checkbox" },
                  ]} />
                  <p className="text-xs text-ink-400">Leave hours and cost blank if not known — nothing is estimated automatically.</p>
                </ActionForm>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={`NDT (${weld.ndt.length})`} actions={p.has("ndt.write") && <Link className="btn-secondary btn-sm" href={`/ndt?projectId=${weld.projectId}&weldId=${weld.id}`}>Add NDT</Link>}>
            {weld.ndt.length ? weld.ndt.map((n) => (
              <div key={n.id} className="flex items-center justify-between border-b border-ink-600/60 py-1.5 text-sm last:border-0">
                <span>{n.code} · {n.method}<span className="block text-xs text-ink-300">{n.reportNo ? `Report ${n.reportNo}` : "Awaiting report"}</span></span>
                <Badge value={n.result} />
              </div>
            )) : <p className="text-sm text-ink-300">{weld.ndtRequired ? "NDT required — none requested yet." : "No NDT records."}</p>}
          </Card>
          <Card title="NCRs">
            {weld.ncrs.length ? weld.ncrs.map((n) => <div key={n.id} className="flex items-center gap-2 py-1 text-sm"><Link className="link" href={`/ncr/${n.id}`}>{n.code}</Link><Badge value={n.status} /></div>) : <p className="text-sm text-ink-300">None</p>}
          </Card>
          <Card title={`Photos (${weld.photos.length})`}>
            <PhotoThumbs photos={weld.photos} />
          </Card>
          {p.has("weld.write") && (
            <Card title="Edit weld record">
              <ActionForm action={updateWeldAction.bind(null, weld.id)} submit="Save">
                <Fields cols={1} fields={[
                  { name: "componentRef", label: "Component", defaultValue: weld.componentRef },
                  { name: "drawingRef", label: "Drawing", defaultValue: weld.drawingRef },
                  { name: "wpsRef", label: "WPS reference", defaultValue: weld.wpsRef },
                  { name: "welderId", label: "Welder ID", defaultValue: weld.welderId },
                  { name: "welderQualRef", label: "Welder qualification", defaultValue: weld.welderQualRef },
                  { name: "process", label: "Process", defaultValue: weld.process },
                  { name: "materialDetails", label: "Material details", defaultValue: weld.materialDetails },
                  { name: "stage", label: "Stage", type: "select", options: vocab.productionStages, defaultValue: weld.stage },
                  { name: "ndtRequired", label: "NDT required", type: "checkbox", defaultValue: weld.ndtRequired },
                ]} />
              </ActionForm>
            </Card>
          )}
          <Card title="History"><History events={history} /></Card>
        </div>
      </div>
    </div>
  );
}
