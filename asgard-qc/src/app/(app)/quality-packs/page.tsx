import { FilterBar, FilterInput, FilterSelect } from "@/components/fields";
import { PackSummary, PackTable, RecordPackForm } from "@/components/packs/PackViews";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { projectOptions } from "@/lib/options";
import { str, type SP } from "@/lib/params";
import { DISCIPLINES, listPacks, packCounts } from "@/lib/services/quality-packs";

export const metadata = { title: "Quality Packs" };

export default async function QualityPacksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePagePermission("records.view");
  const sp = await searchParams;
  const projectId = str(sp, "projectId");
  const stageRaw = str(sp, "stage");
  const stage = stageRaw === "ISSUED" || stageRaw === "RETURNED" ? stageRaw : null;
  const discipline = str(sp, "discipline");
  const q = str(sp, "q");
  const msg = str(sp, "msg");
  const [rows, counts, projects] = await Promise.all([listPacks({ projectId, stage, discipline, q }), packCounts({ projectId }), projectOptions()]);
  const returned = counts.reduce((n, c) => n + c.returned, 0);
  const issued = counts.reduce((n, c) => n + c.issued, 0);
  const canWrite = actor.permissions.has("inspection.write");
  const back = `/quality-packs?${new URLSearchParams(Object.entries({ projectId, stage, discipline, q }).filter((e): e is [string, string] => !!e[1])).toString()}`;
  const hrefFor = (id: string, s?: string) => `/quality-packs?projectId=${id}${s ? `&stage=${s}` : ""}`;

  return (
    <div>
      <PageHeader title="Quality Packs" subtitle="Inspection and QC packs per project and discipline: issued to the shop floor, and returned completed. Files stay in SharePoint." />
      {msg && <p className="mb-4 rounded-lg border border-gold-600/50 bg-gold-500/10 px-4 py-3 text-sm" role="status">{msg}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Returned packs" value={returned} tone="ok" href="/quality-packs?stage=RETURNED" />
        <Stat label="Issued, not back" value={issued} tone={issued ? "warn" : undefined} href="/quality-packs?stage=ISSUED" />
        <Stat label="Projects with packs" value={counts.length} />
      </div>
      {counts.length > 0 && <Card title="By project" pad={false} className="mb-5"><PackSummary counts={counts} hrefFor={hrefFor} /></Card>}
      {canWrite && <Card title="Record a pack" className="mb-5"><RecordPackForm projects={projects} back={back} /></Card>}
      <FilterBar reset="/quality-packs">
        <FilterSelect name="projectId" label="Project" options={projects} value={projectId} empty="All projects" />
        <FilterSelect name="stage" label="Status" options={[{ value: "RETURNED", label: "Returned" }, { value: "ISSUED", label: "Issued (not back)" }]} value={stage} empty="All" />
        <FilterSelect name="discipline" label="Discipline" options={DISCIPLINES.map((d) => ({ value: d, label: d }))} value={discipline} empty="All" />
        <FilterInput name="q" label="Search" value={q} placeholder="Pack or file name" />
      </FilterBar>
      {rows.length === 0 ? <Empty title="No quality packs match">{counts.length ? "Clear the filters to see all packs." : "Packs appear here once imported from SharePoint or recorded above."}</Empty> : (
        <Card title={`${rows.length} pack(s)${rows.length === 1000 ? " — first 1000, use the filters" : ""}`} pad={false}><PackTable rows={rows} canWrite={canWrite} back={back} /></Card>
      )}
    </div>
  );
}
