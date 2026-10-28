import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, fmtDateTime, History, KV, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { alertTransitions, getAlert } from "@/lib/services/alerts";
import { moveAlertAction } from "../actions";

export const metadata = { title: "Alert" };

const label = (s: string) => s.replace(/_/g, " ").toLowerCase();
const VERB: Record<string, string> = { NEW: "Reopen", ACKNOWLEDGED: "Acknowledge", ASSIGNED: "Assign", IN_PROGRESS: "Mark in progress", RESOLVED: "Resolve", DISMISSED: "Dismiss" };

export default async function AlertDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("records.view");
  const { id } = await params;
  const { alert: a, history, rule } = await getAlert(actor, id);
  const evidence = Array.isArray(a.evidence) ? (a.evidence as { ref: string; href?: string; note?: string }[]) : [];
  const canManage = actor.permissions.has("alert.manage");
  const stillPresent = (a.status === "RESOLVED" || a.status === "DISMISSED") && !a.conditionClearedAt;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${a.code} — ${a.title}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge value={a.severity} /> <Badge value={a.status} /> <span className="text-xs text-ink-300">{a.category}</span> <Link className="link" href="/alerts">All alerts</Link></span>}
      />
      {stillPresent && <div className="rounded-lg border border-warn-400/40 bg-warn-400/5 px-4 py-2 text-xs text-warn-400">The triggering condition is still present in the records.</div>}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card title="Why this alert was raised">
            <KV
              items={[
                ["Rule", rule ? `${rule.name} (version ${a.ruleVersion}${rule.version !== a.ruleVersion ? `, now v${rule.version}` : ""})` : a.ruleKey],
                ["Condition", rule?.description.replace(/\{(\w+)\}/g, (_, k) => String((rule.params as Record<string, number> | null)?.[k] ?? `{${k}}`))],
                ["Detail", a.detail],
                ["Project", a.project ? `${a.project.code} ${a.project.name}` : "—"],
                ["First raised", fmtDateTime(a.firstRaisedAt)],
                ["Last confirmed", fmtDateTime(a.lastSeenAt)],
                ["Condition cleared", fmtDateTime(a.conditionClearedAt)],
              ]}
            />
            <h3 className="mt-4 text-sm font-medium text-ink-100">Records that triggered it</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {evidence.map((e, i) => (
                <li key={i}>{e.href ? <Link className="link" href={e.href}>{e.ref}</Link> : e.ref}{e.note && <span className="text-ink-300"> — {e.note}</span>}</li>
              ))}
            </ul>
            {a.href && <p className="mt-3"><Link className="btn-secondary btn-sm" href={a.href}>Open the record</Link></p>}
          </Card>
          <Card title="Handling">
            <KV items={[["Acknowledged", a.acknowledgedAt ? `${a.acknowledgedByName} · ${fmtDateTime(a.acknowledgedAt)}` : "—"], ["Assigned to", a.assignedToName], ["Resolved / dismissed", a.resolvedAt ? `${a.resolvedByName} · ${fmtDateTime(a.resolvedAt)}` : "—"], ["Resolution", a.resolutionNote], ["Dismissal reason", a.dismissedReason], ["Times reopened", String(a.reopenCount)]]} />
            {canManage && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {alertTransitions(a.status).map((s) => (
                  <details key={s} className="rounded border border-ink-600 p-2">
                    <summary className="cursor-pointer text-xs font-medium">{VERB[s] ?? label(s)}</summary>
                    <div className="mt-2">
                      <ActionForm action={moveAlertAction.bind(null, a.id)} submit={VERB[s] ?? label(s)} submitClass="btn-secondary btn-sm">
                        <input type="hidden" name="status" value={s} />
                        {s === "ASSIGNED" && <input name="assignedToName" required className="input text-xs" placeholder="Owner" defaultValue={a.assignedToName ?? ""} />}
                        {(s === "RESOLVED" || s === "DISMISSED" || s === "NEW") && <textarea name="note" required rows={2} className="input text-xs" placeholder={s === "RESOLVED" ? "How it was resolved (link the NCR/CMR/record)" : "Reason"} />}
                      </ActionForm>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card title="History"><History events={history} /></Card>
      </div>
    </div>
  );
}
