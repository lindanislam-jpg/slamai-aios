"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { useApi } from "@/lib/voice/client";
import { Card, CardHeader, EmptyState, ErrorState, Loading, Pager, Table, Td, Th } from "../ui";

type Entry = {
  id: string; action: string; entityType: string | null; entityId: string | null;
  metadata: string | null; ip: string | null; createdAt: string;
  user: { name: string | null; email: string } | null;
};

export default function AuditSettings() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useApi<{
    items: Entry[]; page: number; pageCount: number; total: number;
  }>(`/api/v1/audit?page=${page}`);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="h-6 w-6" />}
        title="Nothing logged yet"
        description="Every meaningful change — a new receptionist, an edited lead, a plan change — is recorded here with who did it and when."
      />
    );
  }

  return (
    <Card>
      <CardHeader title="Activity log" description={`${data.total} recorded actions.`} />
      <Table>
        <thead>
          <tr>
            <Th>Who</Th>
            <Th>Did what</Th>
            <Th>To</Th>
            <Th>When</Th>
            <Th>From</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((entry) => (
            <tr key={entry.id} className="transition-colors hover:bg-white/[0.02]">
              <Td>
                <div className="text-[13px] text-slate-200">{entry.user?.name ?? entry.user?.email ?? "System"}</div>
              </Td>
              <Td className="font-mono text-[12.5px] text-slate-300">{entry.action}</Td>
              <Td className="text-[12.5px] text-slate-500">{entry.entityType ?? "—"}</Td>
              <Td className="whitespace-nowrap text-[13px] text-slate-400">
                {new Date(entry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </Td>
              <Td className="font-mono text-[12px] text-slate-500">{entry.ip ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={data.page} pageCount={data.pageCount} onChange={setPage} />
    </Card>
  );
}
