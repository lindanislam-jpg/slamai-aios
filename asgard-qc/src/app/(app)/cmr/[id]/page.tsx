import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { CmrAttachmentUpload } from "@/components/cmr/CmrAttachmentUpload";
import { Fields } from "@/components/fields";
import { Badge, Card, fmtDate, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { CMR_ATTACH_MAX_MB, cmrTransitions, getCmr } from "@/lib/services/cmrs";
import { moveCmrAction, reopenCmrAction, updateCmrWorkAction } from "../actions";

export const metadata = { title: "CMR" };

const label = (s: string) => s.replace(/_/g, " ").toLowerCase();

const MOVE_HELP: Record<string, string> = {
  ACKNOWLEDGED: "Acknowledge receipt",
  ASSIGNED: "Assign to a technician",
  IN_PROGRESS: "Start / resume work",
  AWAITING_PARTS: "Waiting for parts",
  AWAITING_EXTERNAL: "Waiting for external support",
  AWAITING_VERIFICATION: "Work done — request verification",
  COMPLETED: "Verify repair (authorised person)",
  CLOSED: "Close",
  CANCELLED: "Cancel (reason required)",
};

export default async function CmrDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const { cmr: c, history, sameAsset } = await getCmr(actor, id);
  const canWork = actor.permissions.has("cmr.work");
  const canVerify = actor.permissions.has("cmr.verify");
  const locked = c.status === "CLOSED" || c.status === "CANCELLED";
  const moves = cmrTransitions(c.status).filter((s) => (s === "COMPLETED" || s === "CLOSED" ? canVerify : canWork));
  const closures = Array.isArray(c.closureHistory) ? (c.closureHistory as Record<string, string | null>[]) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${c.code} — ${c.equipment ? `${c.equipment.assetNo} ${c.equipment.description}` : c.assetLabel}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={c.status} /> <Badge value={c.priority} />
            {c.safetyImpact && <Badge value="SAFETY" tone="bad" label="Safety impact" />}
            {c.equipmentUnavailable && <Badge value="UNAVAILABLE" tone="warn" label="Equipment unavailable" />}
            {c.reopenCount > 0 && <Badge value="REOPENED" tone="warn" label={`Reopened ×${c.reopenCount}`} />}
            <Link className="link" href="/cmr">All CMRs</Link>
          </span>
        }
      />
      <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
        This record does not declare equipment safe or calibrated. Required safety checks, functional tests and calibration must be carried out and verified by authorised personnel.
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card title="Request">
            <KV
              items={[
                ["Problem", <span key="p" className="whitespace-pre-wrap">{c.problem}</span>],
                ["Equipment", c.equipment ? <span key="e">{c.equipment.assetNo} {c.equipment.description} <Badge value={c.equipment.status} /></span> : `${c.assetLabel} (not in register)`],
                ["Location", c.location],
                ["Production area", c.productionArea],
                ["Project", c.project ? <Link key="pr" className="link" href={`/projects/${c.project.id}`}>{c.project.code} {c.project.name}</Link> : "—"],
                ["Production impact", c.productionImpact],
                ["Reported", `${fmtDateTime(c.reportedAt)} by ${c.reportedByName ?? "—"}`],
                ["Response needed by", fmtDate(c.requestedBy)],
                ["Acknowledged", c.acknowledgedAt ? `${fmtDateTime(c.acknowledgedAt)} by ${c.acknowledgedByName}` : "—"],
                ["Assigned to", c.assignedToName ? `${c.assignedToName} (${fmtDateTime(c.assignedAt)})` : "—"],
              ]}
            />
          </Card>

          <Card title="Maintenance work log">
            <KV
              items={[
                ["Diagnosis", c.diagnosis],
                ["Work carried out", c.workDone],
                ["Parts used", c.partsUsed],
                ["Started", fmtDateTime(c.startedAt)],
                ["Completed", fmtDateTime(c.completedAt)],
                ["Downtime (hours)", c.downtimeHours?.toString() ?? "—"],
                ["Outstanding issues", <span key="o" className="whitespace-pre-wrap">{c.outstandingIssues ?? "—"}</span>],
              ]}
            />
            {canWork && !locked && (
              <details className="mt-4 rounded-lg border border-ink-600 p-3">
                <summary className="cursor-pointer text-sm font-medium">Update work log</summary>
                <div className="mt-3">
                  <ActionForm action={updateCmrWorkAction.bind(null, c.id)} submit="Save work log">
                    <Fields
                      fields={[
                        { name: "diagnosis", label: "Diagnosis", type: "textarea", defaultValue: c.diagnosis, span: 2 },
                        { name: "workDone", label: "Work carried out", type: "textarea", defaultValue: c.workDone, span: 2 },
                        { name: "partsUsed", label: "Parts used", defaultValue: c.partsUsed, span: 2 },
                        { name: "startedAt", label: "Started", type: "datetime", defaultValue: c.startedAt },
                        { name: "completedAt", label: "Completed", type: "datetime", defaultValue: c.completedAt },
                        { name: "downtimeHours", label: "Downtime (hours)", type: "number", step: "0.25", defaultValue: c.downtimeHours?.toString() },
                        { name: "requestedBy", label: "Response needed by", type: "date", defaultValue: c.requestedBy },
                        { name: "productionImpact", label: "Production impact", defaultValue: c.productionImpact, span: 2 },
                        { name: "outstandingIssues", label: "Outstanding issues", type: "textarea", defaultValue: c.outstandingIssues, span: 2 },
                      ]}
                    />
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>

          <Card title="Verification and return to service">
            <KV items={[["Verified by", c.verifiedByName ? `${c.verifiedByName} · ${fmtDateTime(c.verifiedAt)}` : "Not verified"], ["Verification", c.verificationNote], ["Closed", fmtDateTime(c.closedAt)], ["Cancel reason", c.cancelReason]]} />
            {moves.length > 0 && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {moves.map((s) => (
                  <details key={s} className="rounded border border-ink-600 p-2">
                    <summary className="cursor-pointer text-xs font-medium">{MOVE_HELP[s] ?? label(s)}{s === "IN_PROGRESS" && c.status === "AWAITING_VERIFICATION" ? " — verification not accepted" : ""}</summary>
                    <div className="mt-2">
                      <ActionForm action={moveCmrAction.bind(null, c.id)} submit={label(s)} submitClass="btn-secondary btn-sm" confirm={s === "CANCELLED" ? "Cancel this CMR?" : undefined}>
                        <input type="hidden" name="status" value={s} />
                        {s === "ASSIGNED" && <input name="assignedToName" required className="input text-xs" placeholder="Technician / maintenance owner" defaultValue={c.assignedToName ?? ""} />}
                        {(s === "COMPLETED" || s === "CANCELLED" || (s === "IN_PROGRESS" && c.status === "AWAITING_VERIFICATION")) && (
                          <textarea name="note" required rows={2} className="input text-xs" placeholder={s === "COMPLETED" ? "Verification carried out: functional test, safety checks, calibration as applicable" : "Reason"} />
                        )}
                        {s === "COMPLETED" && c.equipment && c.equipment.status !== "IN_SERVICE" && (
                          <label className="flex items-center gap-2 text-xs text-ink-200"><input type="checkbox" name="returnToService" /> Approve return to service of {c.equipment.assetNo}</label>
                        )}
                      </ActionForm>
                    </div>
                  </details>
                ))}
              </div>
            )}
            {(c.status === "COMPLETED" || c.status === "CLOSED") && actor.permissions.has("cmr.raise") && (
              <details className="mt-4 rounded border border-ink-600 p-2">
                <summary className="cursor-pointer text-xs font-medium">Fault returned — reopen</summary>
                <div className="mt-2">
                  <ActionForm action={reopenCmrAction.bind(null, c.id)} submit="Reopen" submitClass="btn-secondary btn-sm">
                    <textarea name="reason" required rows={2} className="input text-xs" placeholder="What has recurred" />
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>

          {closures.length > 0 && (
            <Card title="Earlier closures">
              <ol className="space-y-3 text-sm">
                {closures.map((h, i) => (
                  <li key={i} className="rounded border border-ink-600 p-2">
                    <div className="text-xs text-ink-300">Closure {i + 1} · verified by {h.verifiedByName ?? "—"} {h.verifiedAt ? fmtDate(h.verifiedAt) : ""} · reopened {fmtDate(h.reopenedAt)} by {h.reopenedBy}</div>
                    <div className="text-ink-100">Work: {h.workDone ?? "—"}</div>
                    <div className="text-ink-200">Reopened because: {h.reopenReason}</div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card title={`Photos and attachments (${c.attachments.length})`}>
            {c.attachments.length > 0 && (
              <ul className="mb-3 divide-y divide-ink-700 text-sm">
                {c.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{a.fileName}{a.caption && <span className="text-ink-300"> — {a.caption}</span>}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-ink-300">{a.uploadedByName} · {fmtDate(a.uploadedAt)}<a className="link" href={`/api/files/cmr-attachment/${a.id}`}>Download</a></span>
                  </li>
                ))}
              </ul>
            )}
            {actor.permissions.has("cmr.raise") ? <CmrAttachmentUpload cmrId={c.id} maxMb={CMR_ATTACH_MAX_MB} /> : !c.attachments.length && <p className="text-sm text-ink-300">No attachments.</p>}
          </Card>
        </div>
        <div className="space-y-5">
          {c.equipmentId && (
            <Card title="Other CMRs on this asset">
              {sameAsset.length ? (
                <ul className="space-y-2 text-sm">
                  {sameAsset.map((o) => (
                    <li key={o.id}><Link className="link" href={`/cmr/${o.id}`}>{o.code}</Link> <Badge value={o.status} /> <span className="text-xs text-ink-300">{fmtDate(o.reportedAt)}</span><div className="truncate text-xs text-ink-200">{o.problem}</div></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-300">No other CMRs for this asset.</p>
              )}
            </Card>
          )}
          <Card title="History"><History events={history} /></Card>
        </div>
      </div>
    </div>
  );
}
