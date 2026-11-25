import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PERMISSIONS, requireAdmin } from "@/remit/server/auth";
import { Card, PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

/** Read-only view of the append-only audit trail. There is no edit or delete. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin(PERMISSIONS.VIEW_AUDIT);
  const raw = await searchParams;
  const action = typeof raw.action === "string" ? raw.action.trim() : "";

  const logs = await db.remitAuditLog.findMany({
    where: action ? { action: { contains: action, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only record of every action. Rows are inserted and never modified or deleted."
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="action"
            defaultValue={action}
            placeholder="Filter by action, e.g. transfer.created"
            className="min-w-[240px] flex-1 rounded-xl border border-send-line px-4 py-2.5 text-[14px]"
          />
          <button
            type="submit"
            className="rounded-xl bg-send-primary px-5 py-2.5 text-[14px] font-bold text-white"
          >
            Filter
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="border-b border-send-line">
            <tr className="text-left text-[11px] uppercase tracking-wide text-send-muted">
              <th className="px-4 py-3 font-bold">When</th>
              <th className="px-4 py-3 font-bold">Actor</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Entity</th>
              <th className="px-4 py-3 font-bold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-send-line">
            {logs.map((log) => (
              <tr key={log.id} className="align-top hover:bg-send-canvas">
                <td className="tnum whitespace-nowrap px-4 py-3 text-send-muted">
                  {log.createdAt.toLocaleString("en-IE")}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-send-canvas px-2 py-0.5 text-[11px] font-bold uppercase text-send-body">
                    {log.actorType}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-send-ink">{log.action}</td>
                <td className="px-4 py-3 text-send-muted">
                  {log.entityType}
                  <div className="text-[11px]">{log.entityId}</div>
                </td>
                <td className="px-4 py-3">
                  {log.metadata ? (
                    <code className="text-[11px] text-send-body">
                      {JSON.stringify(log.metadata)}
                    </code>
                  ) : (
                    <span className="text-send-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-send-muted">
                  No audit entries match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
