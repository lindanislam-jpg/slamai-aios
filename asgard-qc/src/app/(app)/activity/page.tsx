import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { Card, Empty, fmtDateTime, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateParam, str, type SP } from "@/lib/params";

export const metadata = { title: "Activity Log" };
const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("records.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(str(sp, "page") ?? 1) || 1);
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to", true);
  const where: Prisma.AuditEventWhereInput = {
    ...(str(sp, "entityType") ? { entityType: str(sp, "entityType")! } : {}),
    ...(str(sp, "action") ? { action: { contains: str(sp, "action")!, mode: "insensitive" } } : {}),
    ...(str(sp, "actor") ? { actorName: { contains: str(sp, "actor")!, mode: "insensitive" } } : {}),
    ...(from || to ? { at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [events, total, types] = await Promise.all([
    db.auditEvent.findMany({ where, orderBy: { at: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.auditEvent.count({ where }),
    db.auditEvent.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    q.set("page", String(p));
    return `/activity?${q}`;
  };

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="Append-only history of every change made through the application. Entries cannot be edited or deleted from the app." />
      <FilterBar reset="/activity">
        <FilterSelect name="entityType" label="Record type" options={types.map((t) => t.entityType)} value={str(sp, "entityType")} />
        <FilterInput name="action" label="Action contains" value={str(sp, "action")} placeholder="e.g. close, release" />
        <FilterInput name="actor" label="Person" value={str(sp, "actor")} />
        <FilterInput name="from" label="From" type="date" value={str(sp, "from")} />
        <FilterInput name="to" label="To" type="date" value={str(sp, "to")} />
      </FilterBar>
      <Card title={`${total} event(s)`} pad={false}>
        {events.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Summary / changes</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-ink-300">{fmtDateTime(e.at)}</td>
                    <td className="whitespace-nowrap">{e.actorName ?? "system"}</td>
                    <td><code className="text-xs text-gold-300">{e.action}</code></td>
                    <td className="whitespace-nowrap text-ink-300">{e.entityType}</td>
                    <td className="max-w-xl">
                      <div>{e.summary ?? "—"}</div>
                      {(e.before != null || e.after != null) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-ink-300">Before / after</summary>
                          <div className="mt-1 grid gap-2 md:grid-cols-2">
                            <pre className="max-h-60 overflow-auto rounded bg-ink-900 p-2 text-[11px] text-ink-300">{JSON.stringify(e.before, null, 2) ?? "—"}</pre>
                            <pre className="max-h-60 overflow-auto rounded bg-ink-900 p-2 text-[11px] text-ink-200">{JSON.stringify(e.after, null, 2) ?? "—"}</pre>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4"><Empty title="No events match these filters" /></div>
        )}
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link className="btn-secondary btn-sm" href={link(page - 1)}>Previous</Link>}
          <span className="text-ink-300">Page {page} of {pages}</span>
          {page < pages && <Link className="btn-secondary btn-sm" href={link(page + 1)}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
