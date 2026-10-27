import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { str, type SP } from "@/lib/params";
import { globalSearch, type SearchHit } from "@/lib/services/search";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const q = (str(await searchParams, "q") ?? "").slice(0, 100);
  const hits = q.length >= 2 ? await globalSearch(actor, q) : [];
  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) groups.set(h.type, [...(groups.get(h.type) ?? []), h]);

  return (
    <div>
      <PageHeader title="Search" subtitle="Project IDs, frames, inspections, welds, heat numbers, certificates, NCRs, photos and documents." />
      <form method="get" className="card card-pad mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Type at least 2 characters" aria-label="Search" autoFocus />
        <button className="btn-primary">Search</button>
      </form>
      {q.length < 2 ? (
        <Empty title="Enter a search term" />
      ) : hits.length === 0 ? (
        <Empty title={`No records match “${q}”`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...groups.entries()].map(([type, list]) => (
            <Card key={type} title={`${type} (${list.length})`} pad={false}>
              <ul className="divide-y divide-ink-600/70">
                {list.map((h) => (
                  <li key={`${h.href}-${h.code}`}>
                    <Link href={h.href} className="block px-4 py-2.5 hover:bg-ink-700/50">
                      <span className="font-medium text-gold-300">{h.code}</span> <span className="text-ink-200">{h.title}</span>
                      {h.context && <span className="block text-xs text-ink-400">{h.context}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
