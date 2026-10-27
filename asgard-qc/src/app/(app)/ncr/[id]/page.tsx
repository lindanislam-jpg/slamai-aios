import { Camera, Wrench } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { BeforeAfter, Thumbs } from "@/components/ncr/Thumbs";
import { Badge, Card, DemoTag, fmtDate, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { humanize, ROOT_CAUSE_CATEGORIES, ROOT_CAUSE_METHODS } from "@/lib/domain/constants";
import { allowedTransitions, closureProblems, getNcr, OPEN_NCR } from "@/lib/services/ncrs";
import { actionStatusAction, addActionAction, closeNcrAction, moveNcrAction, updateNcrAction } from "../actions";

export const metadata = { title: "NCR" };

const FIVE_WHYS = "Problem:\n1. Why? \n2. Why? \n3. Why? \n4. Why? \n5. Why? \nRoot cause:";

/** Transitions that must carry a reason. */
const needsReason = (from: string, to: string) => to === "CANCELLED" || from === "CLOSED";

export default async function NcrDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const { ncr: n, history, related } = await getNcr(actor, id);
  const can = (p: Parameters<typeof actor.permissions.has>[0]) => actor.permissions.has(p);
  const isOpen = OPEN_NCR.includes(n.status);
  const overdue = isOpen && n.targetDate && n.targetDate < new Date();
  const problems = closureProblems({ ...n, reinspectionResult: "PASS", verificationNotes: "x" }); // structural gaps only
  const transitions = allowedTransitions(n.status).filter((t) => (n.status === "CLOSED" || t === "CANCELLED" ? can("ncr.close") : can("ncr.manage")));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${n.code} — ${n.defectCategory}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={n.status} /> <Badge value={n.priority} />
            {overdue && <Badge tone="bad" label="Overdue" />}
            <DemoTag show={n.isDemo} />
            <span>
              <Link className="link" href={`/projects/${n.project.id}`}>{n.project.code}</Link> {n.project.name}
            </span>
          </span>
        }
        actions={
          <>
            {can("photo.upload") && (
              <Link className="btn-secondary" href={`/photos?upload=1&projectId=${n.project.id}&ncrId=${n.id}`}>
                <Camera className="h-4 w-4" /> Add evidence
              </Link>
            )}
            {can("rework.write") && (
              <Link className="btn-secondary" href={`/rework?new=1&projectId=${n.project.id}&ncrId=${n.id}${n.unit ? `&unitId=${n.unit.id}` : ""}`}>
                <Wrench className="h-4 w-4" /> Record repair
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card title="Non-conformance">
            <KV
              items={[
                ["Description", n.description],
                ["Raised", `${fmtDateTime(n.raisedAt)} by ${n.raisedByName ?? "—"}`],
                ["Module / frame", n.unit ? n.unit.ref : "—"],
                ["Component", n.componentRef],
                ["Requirement reference", n.requirementRef],
                ["Owner / target", `${n.ownerName ?? "—"} · ${fmtDate(n.targetDate)}`],
                ["Linked inspection", n.inspection ? <Link className="link" href={`/inspections/${n.inspection.id}`}>{n.inspection.code} ({humanize(n.inspection.result)})</Link> : "—"],
                ["Linked weld", n.weld ? <Link className="link" href={`/welding/${n.weld.id}`}>{n.weld.weldRef} ({humanize(n.weld.status)})</Link> : "—"],
                ["Linked material", n.material ? <Link className="link" href={`/materials/${n.material.id}`}>{n.material.code}{n.material.heatNumber ? ` · heat ${n.material.heatNumber}` : ""}</Link> : "—"],
                ["Related NCRs", n.relatedCodes.length ? n.relatedCodes.join(", ") : "—"],
              ]}
            />
          </Card>

          <Card title="Containment & investigation">
            {isOpen && can("ncr.manage") ? (
              <ActionForm action={updateNcrAction.bind(null, n.id)} submit="Save investigation">
                <Fields
                  fields={[
                    { name: "containment", label: "Containment", type: "textarea", defaultValue: n.containment, span: 2 },
                    { name: "rootCauseCategory", label: "Root cause category", type: "select", options: [...ROOT_CAUSE_CATEGORIES], defaultValue: n.rootCauseCategory },
                    { name: "rootCauseMethod", label: "Method", type: "select", options: [...ROOT_CAUSE_METHODS], defaultValue: n.rootCauseMethod },
                    { name: "rootCause", label: "Root cause analysis", type: "textarea", defaultValue: n.rootCause, placeholder: FIVE_WHYS, span: 2, hint: "Template shown as a placeholder (it is never saved). For fishbone, list causes per category (Method, Machine, Material, Man, Measurement, Environment)." },
                    { name: "disposition", label: "Disposition", defaultValue: n.disposition, hint: "e.g. Repair, Rework, Use-as-is (concession), Scrap — as approved." },
                    { name: "repairMethod", label: "Repair method", defaultValue: n.repairMethod },
                    { name: "ownerName", label: "Owner", defaultValue: n.ownerName },
                    { name: "targetDate", label: "Target date", type: "date", defaultValue: n.targetDate },
                    { name: "priority", label: "Priority", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({ value: p, label: p.toLowerCase() })), defaultValue: n.priority, allowEmpty: false },
                    { name: "requirementRef", label: "Requirement reference", defaultValue: n.requirementRef },
                  ]}
                />
              </ActionForm>
            ) : (
              <KV
                items={[
                  ["Containment", n.containment],
                  ["Root cause", n.rootCause ? `${n.rootCauseCategory ? `[${n.rootCauseCategory}] ` : ""}${n.rootCause}` : null],
                  ["Method", n.rootCauseMethod],
                  ["Disposition", n.disposition],
                  ["Repair method", n.repairMethod],
                ]}
              />
            )}
          </Card>

          <Card title="Corrective & preventive actions">
            {n.actions.length ? (
              <div className="table-wrap mb-4">
                <table className="tbl">
                  <thead>
                    <tr><th>Action</th><th>Type</th><th>Description</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {n.actions.map((a) => {
                      const late = a.dueDate && a.dueDate < new Date() && (a.status === "OPEN" || a.status === "IN_PROGRESS");
                      const next: { s: string; l: string; perm: boolean; cls: string }[] = [];
                      if (a.status === "OPEN") next.push({ s: "IN_PROGRESS", l: "Start", perm: can("ncr.manage"), cls: "btn-secondary btn-sm" });
                      if (a.status === "OPEN" || a.status === "IN_PROGRESS") next.push({ s: "COMPLETED", l: "Complete", perm: can("ncr.manage"), cls: "btn-secondary btn-sm" });
                      if (a.status === "COMPLETED") next.push({ s: "VERIFIED", l: "Verify", perm: can("ncr.close"), cls: "btn-ok btn-sm" });
                      if (a.status === "OPEN" || a.status === "IN_PROGRESS") next.push({ s: "CANCELLED", l: "Cancel", perm: can("ncr.manage"), cls: "btn-ghost btn-sm" });
                      return (
                        <tr key={a.id}>
                          <td className="whitespace-nowrap">{a.code}</td>
                          <td>{humanize(a.type)}</td>
                          <td className="max-w-sm whitespace-pre-wrap">{a.description}{a.notes && <div className="mt-1 text-xs text-ink-300">{a.notes}</div>}</td>
                          <td>{a.ownerName ?? "—"}</td>
                          <td className={late ? "whitespace-nowrap text-bad-400" : "whitespace-nowrap"}>{fmtDate(a.dueDate)}</td>
                          <td><Badge value={a.status} /></td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {next.filter((x) => x.perm && isOpen).map((x) => (
                                <ActionForm key={x.s} inline action={actionStatusAction.bind(null, n.id, a.id)} submit={x.l} submitClass={x.cls} confirm={x.s === "CANCELLED" ? `Cancel ${a.code}?` : undefined}>
                                  <input type="hidden" name="status" value={x.s} />
                                </ActionForm>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-4 text-sm text-ink-300">No actions yet.</p>
            )}
            {isOpen && can("ncr.manage") && (
              <details className="rounded-lg border border-ink-600 p-3">
                <summary className="cursor-pointer text-sm font-medium text-ink-100">Add action</summary>
                <div className="mt-3">
                  <ActionForm action={addActionAction.bind(null, n.id)} submit="Add action" resetOnSuccess>
                    <Fields
                      fields={[
                        { name: "type", label: "Type", type: "select", options: [{ value: "CORRECTIVE", label: "Corrective" }, { value: "PREVENTIVE", label: "Preventive" }, { value: "CONTAINMENT", label: "Containment" }], defaultValue: "CORRECTIVE", allowEmpty: false },
                        { name: "ownerName", label: "Owner" },
                        { name: "description", label: "Description", type: "textarea", required: true, span: 2 },
                        { name: "dueDate", label: "Due date", type: "date" },
                      ]}
                    />
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>

          <Card title="Verification & closure">
            {n.status === "CLOSED" ? (
              <KV
                items={[
                  ["Closed", `${fmtDateTime(n.closedAt)} by ${n.closedByName ?? "—"}`],
                  ["Re-inspection", humanize(n.reinspectionResult)],
                  ["Verification evidence", n.verificationNotes],
                ]}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink-300">
                  An NCR closes only through this verification step by someone with closure authority. Uploading a repair photograph does not close an NCR.
                </p>
                {problems.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {problems.map((p) => (
                      <li key={p} className="text-warn-400">• {p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ok-400">Ready for verification: root cause recorded and all actions verified.</p>
                )}
                {can("ncr.close") ? (
                  n.status === "AWAITING_VERIFICATION" ? (
                    <ActionForm action={closeNcrAction.bind(null, n.id)} submit="Verify and close NCR" submitClass="btn-ok" confirm={`Close ${n.code}? This records you as the verifier.`}>
                      <Fields
                        fields={[
                          { name: "reinspectionResult", label: "Re-inspection result", type: "select", required: true, options: [{ value: "PASS", label: "Pass" }, { value: "FAIL", label: "Fail" }, { value: "HOLD", label: "Hold" }, { value: "NA", label: "Not applicable" }] },
                          { name: "verificationNotes", label: "Verification evidence / notes", type: "textarea", required: true, span: 2, hint: "What was checked, by whom, against which requirement, and which evidence (photo/inspection IDs)." },
                        ]}
                      />
                    </ActionForm>
                  ) : (
                    <p className="text-sm text-ink-300">Move the NCR to “Awaiting verification” when all actions are complete and verified.</p>
                  )
                ) : (
                  <p className="text-sm text-ink-300">Closure requires the NCR closure permission (Quality Manager).</p>
                )}
              </div>
            )}
          </Card>

          <Card title="Evidence photographs" actions={can("photo.upload") ? <Link className="link text-xs" href={`/photos?upload=1&projectId=${n.project.id}&ncrId=${n.id}`}>Upload</Link> : undefined}>
            <Thumbs photos={n.photos} />
          </Card>

          <Card title="Repairs">
            {n.repairs.length ? (
              <div className="space-y-4">
                {n.repairs.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-600 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink-100">{r.code}</span>
                      <span className="text-ink-200">{r.description}</span>
                      <Badge value={r.reinspectionResult} label={`Re-inspection: ${humanize(r.reinspectionResult)}`} />
                    </div>
                    <BeforeAfter photos={r.photos} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-300">No repairs recorded.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <div className="mb-3 flex items-center gap-2 text-sm">Current: <Badge value={n.status} /></div>
            {transitions.length ? (
              <div className="space-y-2">
                {transitions.map((to) => (
                  <ActionForm key={to} action={moveNcrAction.bind(null, n.id)} inline submit={`Move to ${humanize(to).toLowerCase()}`} submitClass={to === "CANCELLED" ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
                    <input type="hidden" name="to" value={to} />
                    {needsReason(n.status, to) && <input name="note" required placeholder="Reason (required)" className="input max-w-[220px] py-1.5 text-xs" />}
                  </ActionForm>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-300">No status changes available to you.</p>
            )}
          </Card>
          <Card title="Recurring / related NCRs">
            {related.length ? (
              <ul className="space-y-1.5 text-sm">
                {related.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link className="link" href={`/ncr/${r.id}`}>{r.code}</Link>
                    <span className="text-xs text-ink-300">{r.project.code} · {fmtDate(r.raisedAt)}</span>
                    <Badge value={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-300">No other NCRs with this category on this project or frame.</p>
            )}
          </Card>
          <Card title="History">
            <History events={history} />
          </Card>
        </div>
      </div>
    </div>
  );
}
