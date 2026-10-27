import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Badge, Card, DemoTag, fmtDate, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { humanize } from "@/lib/domain/constants";
import { getAudit } from "@/lib/services/audits";
import { addFindingAction, addFindingCapaAction, findingActionStatus, moveFindingAction, saveAuditAction } from "../actions";
import { auditFields } from "../fields";

export const metadata = { title: "Audit" };

const FINDING_NEXT: Record<string, string[]> = {
  OPEN: ["ACTION_IN_PROGRESS", "AWAITING_VERIFICATION", "CLOSED"],
  ACTION_IN_PROGRESS: ["AWAITING_VERIFICATION"],
  AWAITING_VERIFICATION: ["ACTION_IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"],
};

export default async function AuditDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const { audit: a, history } = await getAudit(actor, id);
  const canWrite = actor.permissions.has("audit.write");
  const checklist = Array.isArray(a.checklist) ? (a.checklist as { question: string; answer: string | null }[]) : [];
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${a.code} — ${a.title}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge value={a.status} /> <DemoTag show={a.isDemo} /> <Link className="link" href="/audits">All audits</Link></span>}
      />
      <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
        References to standards and procedures are for traceability only. They are not a claim that the organisation complies with them.
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card title="Audit details">
            <KV items={[["Type", a.auditType], ["Scheduled", fmtDate(a.scheduledAt)], ["Auditor", a.auditor], ["References (not a compliance claim)", a.standardRefs], ["Scope", a.scope], ["Summary", a.summary]]} />
            {canWrite && (
              <details className="mt-4 rounded-lg border border-ink-600 p-3">
                <summary className="cursor-pointer text-sm font-medium">Edit audit</summary>
                <div className="mt-3">
                  <ActionForm action={saveAuditAction.bind(null, a.id)} submit="Save audit">
                    <Fields fields={auditFields(a)} />
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>
          <Card title="Checklist">
            {checklist.length ? (
              <ol className="list-inside list-decimal space-y-1 text-sm text-ink-100">
                {checklist.map((c, i) => <li key={i}>{c.question}{c.answer && <span className="text-ink-300"> — {c.answer}</span>}</li>)}
              </ol>
            ) : (
              <p className="text-sm text-ink-300">No checklist questions.</p>
            )}
          </Card>
          <Card title="Findings">
            {a.findings.length === 0 && <p className="mb-3 text-sm text-ink-300">No findings recorded.</p>}
            <div className="space-y-4">
              {a.findings.map((f) => {
                const late = f.status !== "CLOSED" && f.dueDate && f.dueDate < now;
                return (
                  <div key={f.id} className="rounded-lg border border-ink-600 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-100">{f.code}</span>
                      <Badge value={f.type} />
                      <Badge value={f.status} />
                      {f.clauseRef && <span className="text-xs text-ink-300">{f.clauseRef}</span>}
                      <span className={late ? "text-xs text-bad-400" : "text-xs text-ink-300"}>Owner {f.ownerName ?? "—"} · due {fmtDate(f.dueDate)}{late ? " · overdue" : ""}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-100">{f.description}</p>
                    {f.evidence && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-300">Evidence: {f.evidence}</p>}
                    {f.actions.length > 0 && (
                      <table className="tbl mt-2">
                        <thead><tr><th>Action</th><th>Description</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                          {f.actions.map((x) => {
                            const next = x.status === "OPEN" ? ["IN_PROGRESS", "COMPLETED"] : x.status === "IN_PROGRESS" ? ["COMPLETED"] : x.status === "COMPLETED" ? ["VERIFIED"] : [];
                            return (
                              <tr key={x.id}>
                                <td>{x.code}</td>
                                <td>{x.description}</td>
                                <td>{x.ownerName ?? "—"}</td>
                                <td>{fmtDate(x.dueDate)}</td>
                                <td><Badge value={x.status} /></td>
                                <td>
                                  {canWrite && (
                                    <div className="flex gap-1">
                                      {next.map((s) => (
                                        <ActionForm key={s} inline action={findingActionStatus.bind(null, a.id, x.id)} submit={humanize(s)} submitClass="btn-secondary btn-sm">
                                          <input type="hidden" name="status" value={s} />
                                        </ActionForm>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {canWrite && (
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <details className="rounded border border-ink-600 p-2">
                          <summary className="cursor-pointer text-xs font-medium">Change status</summary>
                          <div className="mt-2">
                            <ActionForm action={moveFindingAction.bind(null, a.id, f.id)} submit="Update" submitClass="btn-secondary btn-sm">
                              <select name="status" className="input py-1.5 text-xs" required defaultValue="">
                                <option value="" disabled>Move to…</option>
                                {(FINDING_NEXT[f.status] ?? []).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                              </select>
                              <textarea name="evidence" rows={2} className="input text-xs" placeholder="Evidence / closure verification (required to close)" />
                            </ActionForm>
                          </div>
                        </details>
                        <details className="rounded border border-ink-600 p-2">
                          <summary className="cursor-pointer text-xs font-medium">Add corrective action</summary>
                          <div className="mt-2">
                            <ActionForm action={addFindingCapaAction.bind(null, a.id, f.id)} submit="Add" submitClass="btn-secondary btn-sm" resetOnSuccess>
                              <input type="hidden" name="type" value="CORRECTIVE" />
                              <textarea name="description" required rows={2} className="input text-xs" placeholder="Action" />
                              <input name="ownerName" className="input text-xs" placeholder="Owner" />
                              <input name="dueDate" type="date" className="input text-xs" />
                            </ActionForm>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {canWrite && (
              <details className="mt-4 rounded-lg border border-ink-600 p-3">
                <summary className="cursor-pointer text-sm font-medium">Record a finding</summary>
                <div className="mt-3">
                  <ActionForm action={addFindingAction.bind(null, a.id)} submit="Add finding" resetOnSuccess>
                    <Fields
                      fields={[
                        { name: "type", label: "Type", type: "select", required: true, options: [{ value: "NONCONFORMITY", label: "Nonconformity" }, { value: "OBSERVATION", label: "Observation" }, { value: "OPPORTUNITY", label: "Opportunity for improvement" }] },
                        { name: "clauseRef", label: "Clause / procedure ref" },
                        { name: "description", label: "Finding", type: "textarea", required: true, span: 2 },
                        { name: "evidence", label: "Objective evidence", type: "textarea", span: 2 },
                        { name: "ownerName", label: "Owner" },
                        { name: "dueDate", label: "Due date", type: "date" },
                      ]}
                    />
                  </ActionForm>
                </div>
              </details>
            )}
          </Card>
        </div>
        <Card title="History"><History events={history} /></Card>
      </div>
    </div>
  );
}
