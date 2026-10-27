import { FileDown } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Badge, Card, DemoTag, Empty, fmtDateTime, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { str, type SP } from "@/lib/params";
import { releaseReadiness, type ReleaseCheck } from "@/lib/services/release";
import { authoriseAction, revokeAction } from "./actions";

export const metadata = { title: "Final Inspection & Release" };

function CheckList({ checks }: { checks: ReleaseCheck[] }) {
  return (
    <ul className="divide-y divide-ink-600/70">
      {checks.map((c) => (
        <li key={c.key} className="flex gap-3 py-2.5">
          <div className="w-28 shrink-0">
            <Badge value={c.state === "PASS" ? "PASS" : c.state === "FAIL" ? "FAIL" : "NA"} label={c.state === "NOT_REQUIRED" ? "Not required" : c.state === "PASS" ? "Pass" : "Fail"} tone={c.state === "NOT_REQUIRED" ? "neutral" : undefined} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink-100">{c.label}</div>
            <div className="text-xs text-ink-300">{c.detail}</div>
            {c.items && (
              <ul className="mt-1 list-inside list-disc text-xs text-bad-400">
                {c.items.slice(0, 12).map((i) => <li key={i}>{i}</li>)}
                {c.items.length > 12 && <li>…and {c.items.length - 12} more</li>}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Release({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const unitId = str(sp, "unitId");
  const projects = await db.project.findMany({ where: { status: { not: "CANCELLED" } }, orderBy: { code: "desc" }, include: { units: { orderBy: { ref: "asc" } } } });

  // Overview: readiness for every project and its modules/frames.
  const overview = await Promise.all(
    projects.map(async (p) => ({
      p,
      project: await releaseReadiness(actor, p.id, null),
      units: await Promise.all(p.units.map(async (u) => ({ u, r: await releaseReadiness(actor, p.id, u.id) }))),
    })),
  );

  const selected = projectId ? projects.find((p) => p.id === projectId) : null;
  const unit = selected && unitId ? selected.units.find((u) => u.id === unitId) ?? null : null;
  const readiness = selected ? await releaseReadiness(actor, selected.id, unit?.id ?? null) : null;
  const records = await db.releaseRecord.findMany({
    where: selected ? { projectId: selected.id } : {},
    orderBy: { releasedAt: "desc" },
    take: 100,
    include: { project: { select: { code: true } }, unit: { select: { ref: true } } },
  });
  const failing = readiness?.checks.filter((c) => c.state === "FAIL") ?? [];
  const canApprove = actor.permissions.has("release.approve");
  const canConcede = actor.permissions.has("release.concession") && !!readiness?.rules.allowConcession;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final Inspection & Release"
        subtitle="Release is authorised by a person against configured release rules. AI never approves or releases product."
        actions={actor.permissions.has("export.excel") && (
          <a className="btn-secondary" href={`/api/export/release${projectId ? `?projectId=${projectId}` : ""}`}><FileDown className="h-4 w-4" /> Excel checklist</a>
        )}
      />

      <form method="get" className="card card-pad flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <label className="label" htmlFor="rp">Project</label>
          <select id="rp" name="projectId" className="input" defaultValue={projectId ?? ""}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        {selected && (
          <div className="min-w-[200px]">
            <label className="label" htmlFor="ru">Scope</label>
            <select id="ru" name="unitId" className="input" defaultValue={unitId ?? ""}>
              <option value="">Whole project</option>
              {selected.units.map((u) => <option key={u.id} value={u.id}>{u.ref} ({u.type.toLowerCase()})</option>)}
            </select>
          </div>
        )}
        <button className="btn-secondary">Show readiness</button>
      </form>

      {selected && readiness && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card
            title={<span>Release checks — {selected.code}{unit ? ` / ${unit.ref}` : " (whole project)"} <DemoTag show={selected.isDemo} /></span>}
            actions={<Badge value={readiness.ready ? "PASS" : "FAIL"} label={readiness.ready ? "All required checks pass" : `${failing.length} check(s) failing`} />}
          >
            <CheckList checks={readiness.checks} />
            <p className="mt-3 text-xs text-ink-300">Rules are configured in Settings → Release rules. {unit ? "Frame releases check the project's material records, which are tracked per project." : ""}</p>
          </Card>
          <div className="space-y-5">
            <Card title="Release decision">
              {readiness.current ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={readiness.current.status} /> <span className="font-medium text-ink-100">{readiness.current.code}</span>
                  </div>
                  <p className="text-ink-200">Authorised by {readiness.current.releasedByName} on {fmtDateTime(readiness.current.releasedAt)}.</p>
                  {readiness.current.concessionRef && <p className="text-warn-400">Concession {readiness.current.concessionRef}: {readiness.current.concessionReason}</p>}
                  {readiness.current.notes && <p className="text-ink-300">{readiness.current.notes}</p>}
                  {canApprove && (
                    <ActionForm action={revokeAction.bind(null, readiness.current.id)} submit="Revoke release" submitClass="btn-danger btn-sm" confirm="Revoke this release? The project/frame returns to not released.">
                      <input name="reason" required placeholder="Reason for revoking (required)" className="input" />
                    </ActionForm>
                  )}
                </div>
              ) : !canApprove ? (
                <p className="text-sm text-ink-300">Not released. Authorising release requires the release permission.</p>
              ) : readiness.ready ? (
                <ActionForm action={authoriseAction.bind(null, selected.id, unit?.id ?? null)} submit="Authorise release" submitClass="btn-ok" confirm={`Authorise release of ${selected.code}${unit ? ` / ${unit.ref}` : ""}? You are recorded as the authorising person.`}>
                  <Fields fields={[{ name: "notes", label: "Release notes", type: "textarea", span: 2 }]} />
                </ActionForm>
              ) : canConcede ? (
                <div className="space-y-3">
                  <p className="text-sm text-warn-400">Release is blocked by {failing.length} failing check(s). You may release only under a documented, approved concession.</p>
                  <ActionForm action={authoriseAction.bind(null, selected.id, unit?.id ?? null)} submit="Release under concession" submitClass="btn-danger" confirm="Release with failing checks under the stated concession? This is recorded against your name.">
                    <Fields
                      cols={1}
                      fields={[
                        { name: "concessionRef", label: "Approved concession / deviation reference", required: true, hint: "Reference of the approved concession document (e.g. customer-approved deviation)." },
                        { name: "concessionReason", label: "Justification", type: "textarea", required: true },
                        { name: "notes", label: "Notes", type: "textarea" },
                      ]}
                    />
                  </ActionForm>
                </div>
              ) : (
                <p className="text-sm text-bad-400">Release blocked: {failing.map((f) => f.label).join("; ")}.{readiness.rules.allowConcession ? " A concession release requires a Quality Manager." : " Concession releases are disabled."}</p>
              )}
            </Card>
            <p className="text-xs text-ink-300">AI-generated photo observations are never used as release evidence. The checks above are computed from inspection, NCR, material, weld, NDT and evidence records.</p>
          </div>
        </div>
      )}

      <Card title="Release readiness overview" pad={false}>
        {overview.length === 0 ? (
          <div className="p-4"><Empty title="No projects." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Project / scope</th><th>Status</th><th>Readiness</th><th>Failing checks</th><th>Release</th></tr></thead>
              <tbody>
                {overview.flatMap(({ p, project, units }) => [
                  <tr key={p.id}>
                    <td><Link className="link font-medium" href={`/release?projectId=${p.id}`}>{p.code}</Link> {p.name} <DemoTag show={p.isDemo} /></td>
                    <td><Badge value={p.status} /></td>
                    <td><Badge value={project.ready ? "PASS" : "FAIL"} label={project.ready ? "Ready" : "Not ready"} /></td>
                    <td className="text-xs text-ink-300">{project.checks.filter((c) => c.state === "FAIL").map((c) => c.label).join("; ") || "—"}</td>
                    <td>{project.current ? <Badge value={project.current.status} label={project.current.code} /> : <span className="text-ink-300">—</span>}</td>
                  </tr>,
                  ...units.map(({ u, r }) => (
                    <tr key={u.id}>
                      <td className="pl-8"><Link className="link" href={`/release?projectId=${p.id}&unitId=${u.id}`}>{u.ref}</Link> <span className="text-xs text-ink-300">{u.type.toLowerCase()}</span></td>
                      <td>{u.released ? <Badge value="RELEASED" /> : <span className="text-xs text-ink-300">not released</span>}</td>
                      <td><Badge value={r.ready ? "PASS" : "FAIL"} label={r.ready ? "Ready" : "Not ready"} /></td>
                      <td className="text-xs text-ink-300">{r.checks.filter((c) => c.state === "FAIL").map((c) => c.label).join("; ") || "—"}</td>
                      <td>{r.current ? <Badge value={r.current.status} label={r.current.code} /> : <span className="text-ink-300">—</span>}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Release records${selected ? ` — ${selected.code}` : ""}`}>
        {records.length === 0 ? (
          <Empty title="No releases recorded." />
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <details key={r.id} className="rounded-lg border border-ink-600 p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink-100">{r.code}</span>
                  <span>{r.project.code}{r.unit ? ` / ${r.unit.ref}` : ""}</span>
                  <Badge value={r.status} />
                  <span className="text-xs text-ink-300">{r.releasedByName} · {fmtDateTime(r.releasedAt)}</span>
                  {r.revokedAt && <span className="text-xs text-bad-400">revoked {fmtDateTime(r.revokedAt)}: {r.revokeReason}</span>}
                </summary>
                <div className="mt-3">
                  {r.concessionRef && <p className="mb-2 text-sm text-warn-400">Concession {r.concessionRef}: {r.concessionReason}</p>}
                  <p className="mb-1 text-xs text-ink-300">Checks as evaluated at release:</p>
                  <CheckList checks={r.checks as unknown as ReleaseCheck[]} />
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
