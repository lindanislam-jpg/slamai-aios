import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, Empty, fmtDate } from "@/components/ui";
import type { Actor } from "@/lib/permissions";
import { projectItp, signPermission } from "@/lib/services/itp";
import { naPointAction, reopenPointAction, signPointAction } from "./itp-actions";
import { ItpUpload } from "./ItpUpload";

const POINT_LABEL: Record<string, string> = { H: "Hold", W: "Witness", I: "Inspect", R: "Review", M: "Monitor", S: "Surveillance", A: "Accept" };

function Code({ v, title }: { v: string | null; title: string }) {
  if (!v) return <span className="text-ink-500">·</span>;
  return (
    <span title={`${title}: ${POINT_LABEL[v] ?? v}`} className={v === "H" ? "rounded bg-bad-600/25 px-1.5 text-xs font-bold text-bad-400" : v === "W" ? "rounded bg-warn-600/20 px-1.5 text-xs font-bold text-warn-400" : "rounded bg-ink-600 px-1.5 text-xs font-semibold text-ink-200"}>
      {v}
    </span>
  );
}

export async function ItpTab({ actor, projectId }: { actor: Actor; projectId: string }) {
  const plans = await projectItp(actor, projectId);
  const canApply = actor.permissions.has("project.write");
  const holds = plans.flatMap((p) => p.points.filter((x) => x.pointType === "H"));
  const openHolds = holds.filter((h) => h.status === "OPEN");

  return (
    <div className="space-y-4">
      {plans.length > 0 && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${openHolds.length ? "border-bad-600/50 bg-bad-600/10 text-bad-400" : "border-ok-600/50 bg-ok-600/10 text-ok-400"}`}>
          {openHolds.length
            ? `${openHolds.length} of ${holds.length} Hold Point(s) open — project release is blocked until each is signed by an authorised person or marked not applicable.`
            : `All ${holds.length} Hold Point(s) signed or not applicable.`}
        </div>
      )}
      {canApply && (
        <Card title="Apply the company Inspection & Test Plan">
          <p className="mb-3 text-sm text-ink-300">
            Upload the ITP workbook (QF 6.14). Each discipline sheet becomes a list of control points for this project with the acceptance criteria, responsibility and H/W/I/R codes exactly as written in the ITP.
          </p>
          <ItpUpload projectId={projectId} applied={plans.map((p) => p.discipline)} />
        </Card>
      )}
      {!plans.length && !canApply && <Empty title="No ITP applied to this project yet." />}
      {plans.map((plan) => {
        const sections = [...new Set(plan.points.map((p) => p.section ?? ""))];
        const done = plan.points.filter((p) => p.status !== "OPEN").length;
        return (
          <Card key={plan.id} title={`${plan.discipline} — ${plan.documentRef ?? "ITP"}`} actions={<span className="text-xs text-ink-300">{done}/{plan.points.length} closed · from {plan.sourceFile}</span>} pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="min-w-[280px]">Inspection activity / acceptance criteria</th>
                    <th>Method · frequency</th>
                    <th>Resp.</th>
                    <th>Sign-off document</th>
                    <th title="Sub / AMM / Client / 3rd party">S·A·C·3</th>
                    <th className="min-w-[230px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <SectionRows key={sec} sec={sec} points={plan.points.filter((p) => (p.section ?? "") === sec)} actor={actor} projectId={projectId} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

type Point = Awaited<ReturnType<typeof projectItp>>[number]["points"][number];

function SectionRows({ sec, points, actor, projectId }: { sec: string; points: Point[]; actor: Actor; projectId: string }) {
  return (
    <>
      {sec && (
        <tr>
          <td colSpan={7} className="bg-ink-700/40 text-xs font-semibold uppercase tracking-wide text-gold-300">{sec}</td>
        </tr>
      )}
      {points.map((p) => {
        const canSign = actor.permissions.has(signPermission(p.pointType));
        const canReview = actor.permissions.has("inspection.review");
        return (
          <tr key={p.id} className={p.pointType === "H" && p.status === "OPEN" ? "bg-bad-600/5" : undefined}>
            <td className="font-mono text-xs">{p.itemNo}</td>
            <td>
              <div className="font-medium text-ink-100">{p.activity}</div>
              {p.acceptanceCriteria && (
                <details className="mt-1 text-xs text-ink-300">
                  <summary className="cursor-pointer text-ink-400">Acceptance criteria</summary>
                  <p className="mt-1 whitespace-pre-wrap">{p.acceptanceCriteria}</p>
                  {p.verifyingDocument && <p className="mt-1">Verifying: {p.verifyingDocument}</p>}
                </details>
              )}
            </td>
            <td className="text-xs text-ink-300">
              {p.method ?? "—"}
              <br />
              {[p.frequency, p.extent && p.extent !== p.frequency ? p.extent : null].filter(Boolean).join(" · ")}
            </td>
            <td className="text-xs">{p.responsibility ?? "—"}</td>
            <td className="text-xs">{p.signoffDocument ?? "—"}</td>
            <td className="whitespace-nowrap space-x-1">
              <Code v={p.subPoint} title="Subcontractor" />
              <Code v={p.pointType} title="ASGARD" />
              <Code v={p.clientPoint} title="Client" />
              <Code v={p.thirdPartyPoint} title="3rd party" />
            </td>
            <td>
              {p.status === "OPEN" ? (
                <div className="space-y-2">
                  {canSign ? (
                    <ActionForm action={signPointAction.bind(null, projectId, p.id)} submit={p.pointType === "H" ? "Sign hold point" : "Sign"} submitClass="btn-ok btn-sm" inline>
                      <input name="evidence" required placeholder="Evidence / report ref" className="input py-1 text-xs" aria-label={`Evidence for item ${p.itemNo}`} />
                    </ActionForm>
                  ) : (
                    <span className="text-xs text-ink-400">{p.pointType === "H" || p.pointType === "A" ? "Needs Quality Manager" : "Open"}</span>
                  )}
                  {canReview && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-ink-400">Not applicable…</summary>
                      <ActionForm action={naPointAction.bind(null, projectId, p.id)} submit="Mark N/A" submitClass="btn-secondary btn-sm" inline>
                        <input name="reason" required placeholder="Reason" className="input py-1 text-xs" aria-label="Reason not applicable" />
                      </ActionForm>
                    </details>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <Badge value={p.status === "SIGNED" ? "APPROVED" : "NA"} label={p.status === "SIGNED" ? "Signed" : "Not applicable"} />
                  <div className="text-ink-300">{p.evidence}</div>
                  <div className="text-ink-400">{p.signedByName} · {fmtDate(p.signedAt)}</div>
                  {canReview && (
                    <details>
                      <summary className="cursor-pointer text-ink-400">Reopen…</summary>
                      <ActionForm action={reopenPointAction.bind(null, projectId, p.id)} submit="Reopen" submitClass="btn-danger btn-sm" inline>
                        <input name="reason" required placeholder="Reason" className="input py-1 text-xs" aria-label="Reason to reopen" />
                      </ActionForm>
                    </details>
                  )}
                </div>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
