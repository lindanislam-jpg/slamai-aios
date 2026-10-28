import Link from "next/link";
import { Download } from "lucide-react";
import type { DocStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Fields, FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { RevisionUpload } from "@/components/documents/RevisionUpload";
import { Badge, Card, DemoTag, Empty, fmtDate, fmtDateTime, PageHeader, Stat, Tabs } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { DOCUMENT_TYPES, humanize } from "@/lib/domain/constants";
import { projectOptions } from "@/lib/options";
import { enumParam, str, type SP } from "@/lib/params";
import { listDocuments, listEquipment } from "@/lib/services/documents";
import { addCalibrationAction, approveRevisionAction, createDocumentAction, createEquipmentAction, documentStatusAction, updateEquipmentAction } from "./actions";

export const metadata = { title: "Documents & Calibration" };

const DOC_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "SUPERSEDED", "OBSOLETE"] as const;
const kb = (n: number | null) => (n == null ? "" : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export default async function Documents({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const tab = str(sp, "tab") === "calibration" ? "calibration" : "documents";
  const [docs, equipment, projects] = await Promise.all([
    tab === "documents" ? listDocuments(actor, { q: str(sp, "q"), docType: str(sp, "docType"), projectId: str(sp, "projectId"), status: enumParam<DocStatus>(sp, "status", DOC_STATUSES) }) : Promise.resolve([]),
    listEquipment(actor),
    projectOptions(),
  ]);
  const can = (p: Parameters<typeof actor.permissions.has>[0]) => actor.permissions.has(p);
  const calCounts = { EXPIRED: 0, DUE_SOON: 0, CURRENT: 0, NO_RECORD: 0 } as Record<string, number>;
  for (const e of equipment) calCounts[e.calStatus]++;

  return (
    <div>
      <PageHeader title="Documents & Calibration" subtitle="Controlled documents with append-only revisions, and inspection equipment calibration status." />
      <Tabs base="/documents" active={tab} tabs={[{ key: "documents", label: "Controlled documents" }, { key: "calibration", label: "Calibration", count: calCounts.EXPIRED + calCounts.NO_RECORD || undefined }]} />

      {tab === "documents" ? (
        <div className="space-y-4">
          <p className="text-xs text-ink-300">An uploaded file is not verified: each revision stays “Under review” until approved by someone other than the uploader. Approved revisions are never overwritten — changes are issued as new revisions and the previous approved revision becomes Superseded.</p>
          {can("document.write") && (
            <Card title="Register document">
              <details>
                <summary className="cursor-pointer text-sm text-ink-200">New controlled document</summary>
                <div className="mt-3">
                  <ActionForm action={createDocumentAction} submit="Register document" resetOnSuccess>
                    <Fields
                      fields={[
                        { name: "docNo", label: "Document number", required: true },
                        { name: "title", label: "Title", required: true },
                        { name: "docType", label: "Type", type: "select", required: true, options: [...DOCUMENT_TYPES] },
                        { name: "projectId", label: "Project (if project-specific)", type: "select", options: projects },
                        { name: "ownerName", label: "Owner" },
                      ]}
                    />
                  </ActionForm>
                </div>
              </details>
            </Card>
          )}
          <FilterBar reset="/documents">
            <input type="hidden" name="tab" value="documents" />
            <FilterInput name="q" label="Search" value={str(sp, "q")} placeholder="Doc no. or title" />
            <FilterSelect name="docType" label="Type" options={[...DOCUMENT_TYPES]} value={str(sp, "docType")} />
            <FilterSelect name="projectId" label="Project" options={projects} value={str(sp, "projectId")} />
            <FilterSelect name="status" label="Status" options={DOC_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} value={str(sp, "status")} />
          </FilterBar>
          {docs.length === 0 ? (
            <Empty title="No documents match." />
          ) : (
            <div className="space-y-2">
              {docs.map((d) => {
                const approved = d.revisions.find((r) => r.status === "APPROVED");
                return (
                  <details key={d.id} className="card" open={docs.length === 1}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className="font-medium text-ink-100">{d.docNo}</span>
                      <span className="text-sm text-ink-200">{d.title}</span>
                      <span className="text-xs text-ink-300">{d.docType}{d.project ? ` · ${d.project.code}` : ""}{d.ownerName ? ` · ${d.ownerName}` : ""}</span>
                      <Badge value={d.status} />
                      <span className="text-xs text-ink-300">{approved ? `Approved rev ${approved.revision}` : "No approved revision"}</span>
                      <DemoTag show={d.isDemo} />
                    </summary>
                    <div className="border-t border-ink-600/70 px-4 py-3">
                      {d.revisions.length ? (
                        <div className="table-wrap mb-3">
                          <table className="tbl">
                            <thead><tr><th>Rev</th><th>File</th><th>Uploaded</th><th>Notes</th><th>Status</th><th>Approved</th><th></th></tr></thead>
                            <tbody>
                              {d.revisions.map((r) => (
                                <tr key={r.id}>
                                  <td className="font-medium">{r.revision}</td>
                                  <td>
                                    {r.storageKey ? (
                                      <a className="link inline-flex items-center gap-1" href={`/api/files/document/${r.id}`}><Download className="h-3.5 w-3.5" />{r.fileName}</a>
                                    ) : (
                                      <span className="text-ink-300">Reference only</span>
                                    )}
                                    {r.sizeBytes ? <span className="ml-1 text-xs text-ink-400">{kb(r.sizeBytes)}</span> : null}
                                    {r.sha256 && <div className="text-[10px] text-ink-400" title={r.sha256}>sha256 {r.sha256.slice(0, 12)}…</div>}
                                  </td>
                                  <td className="whitespace-nowrap">{fmtDateTime(r.uploadedAt)}<div className="text-xs text-ink-300">{r.uploadedByName}</div></td>
                                  <td className="max-w-xs">{r.notes ?? "—"}</td>
                                  <td><Badge value={r.status} label={r.status === "UNDER_REVIEW" ? "Under review — not verified" : undefined} /></td>
                                  <td className="whitespace-nowrap">{r.approvedAt ? `${fmtDate(r.approvedAt)} · ${r.approvedByName}` : "—"}</td>
                                  <td>
                                    {r.status === "UNDER_REVIEW" && can("document.approve") && (r.uploadedById !== actor.id || actor.role === "ADMIN" ? (
                                      <ActionForm inline action={approveRevisionAction.bind(null, r.id)} submit="Approve" submitClass="btn-ok btn-sm" confirm={`Approve ${d.docNo} rev ${r.revision}? The current approved revision will be superseded.`} />
                                    ) : (
                                      <span className="text-xs text-ink-300">Needs another approver</span>
                                    ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mb-3 text-sm text-ink-300">No revisions yet.</p>
                      )}
                      {can("document.write") && d.status !== "OBSOLETE" && <RevisionUpload documentId={d.id} />}
                      {can("document.approve") && (
                        <div className="mt-3">
                          <ActionForm inline action={documentStatusAction.bind(null, d.id)} submit="Set status" submitClass="btn-ghost btn-sm">
                            <select name="status" className="input w-44 py-1.5 text-xs" defaultValue={d.status}>
                              {DOC_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                            </select>
                          </ActionForm>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Expired" value={calCounts.EXPIRED} tone={calCounts.EXPIRED ? "bad" : undefined} />
            <Stat label="Due soon" value={calCounts.DUE_SOON} tone={calCounts.DUE_SOON ? "warn" : undefined} />
            <Stat label="Current" value={calCounts.CURRENT} tone="ok" />
            <Stat label="No calibration record" value={calCounts.NO_RECORD} tone={calCounts.NO_RECORD ? "warn" : undefined} />
          </div>
          {can("calibration.write") && (
            <Card title="Add equipment">
              <ActionForm action={createEquipmentAction} submit="Add equipment" resetOnSuccess>
                <Fields
                  cols={3}
                  fields={[
                    { name: "assetNo", label: "Asset number", required: true },
                    { name: "description", label: "Description", required: true },
                    { name: "equipmentType", label: "Type", placeholder: "e.g. Welding set, saw, gauge" },
                    { name: "ownerName", label: "Responsible owner" },
                    { name: "serialNo", label: "Serial number" },
                    { name: "location", label: "Location" },
                    { name: "intervalDays", label: "Calibration interval (days)", type: "number" },
                  ]}
                />
              </ActionForm>
            </Card>
          )}
          {equipment.length === 0 ? (
            <Empty title="No equipment registered." />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Asset</th><th>Description</th><th>Location / owner</th><th>Availability</th><th>Last calibrated</th><th>Due</th><th>Certificate</th><th>Calibration</th>{can("calibration.write") && <th>Update</th>}</tr></thead>
                <tbody>
                  {equipment.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap font-medium">{e.assetNo} <DemoTag show={e.isDemo} /></td>
                      <td>{e.description}{(e.equipmentType || e.serialNo) && <div className="text-xs text-ink-300">{[e.equipmentType, e.serialNo && `S/N ${e.serialNo}`].filter(Boolean).join(" · ")}</div>}</td>
                      <td>{e.location ?? "—"}{e.ownerName && <div className="text-xs text-ink-300">{e.ownerName}</div>}</td>
                      <td><Badge value={e.status} />{e.statusNote && <div className="text-xs text-ink-300">{e.statusNote}</div>}<div><Link className="link text-xs" href={`/cmr?equipmentId=${e.id}&status=all`}>CMR history</Link></div></td>
                      <td className="whitespace-nowrap">{fmtDate(e.latest?.calibratedAt)}</td>
                      <td className="whitespace-nowrap">{fmtDate(e.latest?.dueAt)}</td>
                      <td>{e.latest?.certificateRef ?? "—"}{e.latest?.provider && <div className="text-xs text-ink-300">{e.latest.provider}</div>}</td>
                      <td><Badge value={e.calStatus} /></td>
                      {can("calibration.write") && (
                        <td>
                          <details>
                            <summary className="cursor-pointer text-xs text-gold-300">Add record</summary>
                            <div className="mt-2 w-64">
                              <ActionForm action={addCalibrationAction.bind(null, e.id)} submit="Save" submitClass="btn-secondary btn-sm" resetOnSuccess>
                                <label className="label">Calibrated</label>
                                <input name="calibratedAt" type="date" required className="input text-xs" />
                                <label className="label">Due</label>
                                <input name="dueAt" type="date" required className="input text-xs" />
                                <input name="certificateRef" placeholder="Certificate ref" className="input text-xs" />
                                <input name="provider" placeholder="Provider" className="input text-xs" />
                                <input name="result" placeholder="Result" className="input text-xs" />
                              </ActionForm>
                            </div>
                          </details>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-gold-300">Availability / details</summary>
                            <div className="mt-2 w-64">
                              <ActionForm action={updateEquipmentAction.bind(null, e.id)} submit="Save" submitClass="btn-secondary btn-sm">
                                <label className="label">Availability</label>
                                <select name="status" defaultValue={e.status} className="input text-xs">
                                  {["IN_SERVICE", "RESTRICTED", "OUT_OF_SERVICE", "RETIRED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
                                </select>
                                <input name="statusNote" placeholder="Reason / restriction" defaultValue={e.statusNote ?? ""} className="input text-xs" />
                                <input name="ownerName" placeholder="Responsible owner" defaultValue={e.ownerName ?? ""} className="input text-xs" />
                                <input name="equipmentType" placeholder="Type" defaultValue={e.equipmentType ?? ""} className="input text-xs" />
                                <input name="location" placeholder="Location" defaultValue={e.location ?? ""} className="input text-xs" />
                                <p className="text-xs text-ink-300">After a fault, return to service through CMR verification.</p>
                              </ActionForm>
                            </div>
                          </details>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-ink-300">Calibration certificates can be filed as controlled documents of type “Calibration certificate”. Status uses the “due soon” window from Settings → Notification thresholds.</p>
        </div>
      )}
    </div>
  );
}
