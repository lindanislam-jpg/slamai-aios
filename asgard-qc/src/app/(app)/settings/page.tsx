import Link from "next/link";
import type { Role } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { storage } from "@/lib/storage";
import { Badge, Card, Empty, fmtDateTime, KV, PageHeader, Tabs } from "@/components/ui";
import { aiStatus } from "@/lib/ai/vision";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { INSPECTION_TYPE_LABELS } from "@/lib/domain/constants";
import { qmsStatus } from "@/lib/integrations/qms";
import { str, type SP } from "@/lib/params";
import { PERMISSIONS, permissionsFor, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { demoCounts } from "@/lib/services/settings";
import { getSetting } from "@/lib/settings";
import {
  approveTemplateAction, loadDemoPhotosAction, purgeDemoAction, resetPermissions, saveBranding, saveLimits, savePermissions, saveReleaseRules, saveTemplateAction, saveVocabulary,
} from "./actions";

export const metadata = { title: "Settings & Integrations" };

const RULE_LABELS: [string, string][] = [
  ["requireFinalInspectionPass", "A final inspection must be passed and accepted"],
  ["requireNoUnresolvedInspections", "All inspections complete, reviewed and resolved (failures need an accepted passing re-inspection)"],
  ["requireNoOpenNcrs", "No open NCRs"],
  ["requireNoOpenActions", "All corrective actions verified"],
  ["requireMaterialsAccepted", "All project materials accepted (none quarantined / awaiting inspection)"],
  ["requireCertificatesVerified", "All material certificates verified"],
  ["requireWeldsAccepted", "All welds accepted"],
  ["requireNdtComplete", "No outstanding NDT / test reports"],
  ["requireHoldPointsSigned", "All ITP Hold Points signed or not applicable (project release)"],
  ["allowConcession", "Allow release under a documented concession (Quality Manager only)"],
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("settings.manage");
  const sp = await searchParams;
  const tab = str(sp, "tab") ?? "release";
  return (
    <div>
      <PageHeader title="Settings & Integrations" subtitle="Configuration changes are recorded in the activity log with before and after values." />
      <Tabs
        base="/settings"
        active={tab}
        tabs={[
          { key: "release", label: "Release rules" },
          { key: "vocabulary", label: "Categories & stages" },
          { key: "limits", label: "Limits & reminders" },
          { key: "permissions", label: "Permissions" },
          { key: "templates", label: "Checklist templates" },
          { key: "integrations", label: "Integrations" },
          { key: "data", label: "Data" },
        ]}
      />
      {tab === "release" && <ReleaseTab />}
      {tab === "vocabulary" && <VocabTab />}
      {tab === "limits" && <LimitsTab />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "templates" && <TemplatesTab edit={str(sp, "edit")} />}
      {tab === "integrations" && <IntegrationsTab />}
      {tab === "data" && <DataTab />}
    </div>
  );
}

async function ReleaseTab() {
  const [rules, vocab] = await Promise.all([getSetting("releaseRules"), getSetting("vocabulary")]);
  const r = rules as unknown as Record<string, unknown>;
  return (
    <Card title="Final release gate">
      <ActionForm action={saveReleaseRules} submit="Save release rules">
        <p className="text-sm text-ink-300">A project or frame cannot be released while an enabled check fails, unless concessions are allowed and an authorised person records the concession reference. Switch a check off only where approved procedures say it does not apply.</p>
        <div className="space-y-2">
          {RULE_LABELS.map(([k, label]) => (
            <label key={k} className="flex items-start gap-2 text-sm text-ink-100">
              <input type="checkbox" name={k} defaultChecked={!!r[k]} className="mt-0.5 h-4 w-4 accent-[#c39a45]" />
              {label}
            </label>
          ))}
        </div>
        <fieldset>
          <legend className="label">Required photographic evidence categories</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {vocab.photoCategories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-ink-200">
                <input type="checkbox" name="requiredPhotoCategories" value={c} defaultChecked={rules.requiredPhotoCategories.includes(c)} className="h-4 w-4 accent-[#c39a45]" />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
      </ActionForm>
    </Card>
  );
}

async function VocabTab() {
  const [vocab, branding] = await Promise.all([getSetting("vocabulary"), getSetting("branding")]);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Photo categories and production stages">
        <ActionForm action={saveVocabulary} submit="Save">
          <Fields
            fields={[
              { name: "photoCategories", label: "Photo categories (one per line)", type: "textarea", defaultValue: vocab.photoCategories.join("\n"), required: true },
              { name: "productionStages", label: "Production stages (one per line, in order)", type: "textarea", defaultValue: vocab.productionStages.join("\n"), required: true },
            ]}
          />
          <p className="text-xs text-ink-300">Removing a value does not change existing records that use it.</p>
        </ActionForm>
      </Card>
      <Card title="Report branding">
        <ActionForm action={saveBranding} submit="Save">
          <Fields
            cols={1}
            fields={[
              { name: "companyName", label: "Company name", defaultValue: branding.companyName, required: true },
              { name: "departmentName", label: "Department", defaultValue: branding.departmentName, required: true },
              { name: "reportFooter", label: "Report footer text", type: "textarea", defaultValue: branding.reportFooter },
            ]}
          />
        </ActionForm>
      </Card>
    </div>
  );
}

async function LimitsTab() {
  const [u, t] = await Promise.all([getSetting("uploadLimits"), getSetting("notificationThresholds")]);
  return (
    <Card title="Upload limits and reminder thresholds">
      <ActionForm action={saveLimits} submit="Save">
        <Fields
          cols={3}
          fields={[
            { name: "maxFileMb", label: "Max file size (MB)", type: "number", defaultValue: u.maxFileMb, required: true },
            { name: "maxFilesPerBatch", label: "Max photos per upload", type: "number", defaultValue: u.maxFilesPerBatch, required: true },
            { name: "ncrDueSoonDays", label: "NCR due-soon warning (days)", type: "number", defaultValue: t.ncrDueSoonDays, required: true },
            { name: "actionDueSoonDays", label: "Audit finding due-soon (days)", type: "number", defaultValue: t.actionDueSoonDays, required: true },
            { name: "calibrationDueSoonDays", label: "Calibration due-soon (days)", type: "number", defaultValue: t.calibrationDueSoonDays, required: true },
            { name: "ndtOutstandingDays", label: "NDT outstanding after (days)", type: "number", defaultValue: t.ndtOutstandingDays, required: true },
            { name: "quarantineReviewDays", label: "Quarantine review after (days)", type: "number", defaultValue: t.quarantineReviewDays, required: true },
            { name: "ncrEffectivenessDays", label: "NCR effectiveness check after closure (days, 0 = off)", type: "number", defaultValue: t.ncrEffectivenessDays, required: true },
          ]}
        />
      </ActionForm>
    </Card>
  );
}

async function PermissionsTab() {
  const overrides = await getSetting("rolePermissions");
  const roles = Object.keys(ROLE_LABELS) as Role[];
  const sets = Object.fromEntries(roles.map((r) => [r, permissionsFor(r, overrides)])) as Record<Role, Set<Permission>>;
  return (
    <Card title={`Role permissions${overrides ? " (customised)" : " (defaults)"}`} actions={<ActionForm action={resetPermissions} submit="Reset to defaults" submitClass="btn-ghost btn-sm" inline confirm="Reset all role permissions to the defaults?" />}>
      <ActionForm action={savePermissions} submit="Save permissions">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Permission</th>{roles.map((r) => <th key={r} className="text-center">{ROLE_LABELS[r]}</th>)}</tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p}>
                  <td><div className="text-ink-100">{PERMISSIONS[p]}</div><code className="text-[10px] text-ink-400">{p}</code></td>
                  {roles.map((r) => {
                    const locked = r === "ADMIN" && (p === "users.manage" || p === "settings.manage" || p === "records.view");
                    return (
                      <td key={r} className="text-center">
                        <input type="checkbox" name={`perm:${r}`} value={p} defaultChecked={sets[r].has(p)} disabled={locked} aria-label={`${ROLE_LABELS[r]}: ${PERMISSIONS[p]}`} className="h-4 w-4 accent-[#c39a45]" />
                        {locked && <input type="hidden" name={`perm:${r}`} value={p} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-300">Administrators always keep user and settings management so nobody can be locked out.</p>
      </ActionForm>
    </Card>
  );
}

async function TemplatesTab({ edit }: { edit: string | null }) {
  const templates = await db.checklistTemplate.findMany({ orderBy: [{ inspectionType: "asc" }, { name: "asc" }] });
  const current = edit ? templates.find((t) => t.id === edit) : null;
  const itemsText = current
    ? (current.items as { description: string; requirement?: string | null; tolerance?: string | null; unit?: string | null }[])
        .map((i) => [i.description, i.requirement ?? "", i.tolerance ?? "", i.unit ?? ""].join(" | ").replace(/( \| )+$/, ""))
        .join("\n")
    : "";
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card title="Checklist templates" pad={false} actions={<Link className="btn-secondary btn-sm" href="/api/export/templates" prefetch={false}>Download QM review pack (Excel)</Link>}>
        {templates.length ? (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Type</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}{t.documentRef && <div className="text-xs text-ink-300">{t.documentRef}</div>}</td>
                  <td>{INSPECTION_TYPE_LABELS[t.inspectionType]}</td>
                  <td>{(t.items as unknown[]).length}</td>
                  <td>{t.approved ? <Badge tone="ok" label={`Approved ${fmtDateTime(t.approvedAt)}`} /> : <Badge tone="warn" label="Not approved" />}</td>
                  <td className="whitespace-nowrap">
                    <a className="link mr-3 text-xs" href={`/settings?tab=templates&edit=${t.id}`}>Edit</a>
                    {!t.approved && <ActionForm action={approveTemplateAction.bind(null, t.id)} submit="Approve" submitClass="btn-ok btn-sm" inline confirm="Approve this checklist? Confirm its requirements come from approved documents." />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-4"><Empty title="No templates yet">Inspections can still be recorded with ad-hoc checklist items.</Empty></div>
        )}
      </Card>
      <Card title={current ? `Edit: ${current.name}` : "New template"} actions={current ? <a className="link text-xs" href="/settings?tab=templates">New instead</a> : null}>
        <ActionForm key={current?.id ?? "new"} action={saveTemplateAction.bind(null, current?.id ?? null)} submit={current ? "Save (requires re-approval)" : "Create template"} resetOnSuccess={!current}>
          <Fields
            cols={1}
            fields={[
              { name: "name", label: "Template name", required: true, defaultValue: current?.name },
              { name: "inspectionType", label: "Inspection type", type: "select", required: true, defaultValue: current?.inspectionType, options: Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "documentRef", label: "Source document (ITP / procedure ref)", defaultValue: current?.documentRef },
              {
                name: "items",
                label: "Checklist items — one per line",
                type: "textarea",
                required: true,
                defaultValue: itemsText,
                placeholder: "Overall length | Per drawing DWG-100 rev C | ±3 | mm",
                hint: "Format: description | requirement | tolerance | unit. Leave requirement blank if it is not yet approved — the item will be flagged “requires configuration”, never assumed.",
              },
            ]}
          />
        </ActionForm>
      </Card>
    </div>
  );
}

async function IntegrationsTab() {
  const qms = qmsStatus();
  const ai = aiStatus();
  let dbStatus = "error";
  try {
    const rows = await db.$queryRaw<{ version: string }[]>`SELECT version()`;
    dbStatus = `Connected — ${rows[0]?.version.split(" ").slice(0, 2).join(" ")}`;
  } catch {
    dbStatus = "Not reachable";
  }
  const driver = storage().driver;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="External QMS / document system">
        <KV items={[["Status", <Badge key="s" tone={qms.connected ? "ok" : "warn"} label={qms.label} />], ["Provider", qms.provider ?? "None configured"], ["Detail", qms.detail]]} />
        <p className="mt-3 text-xs text-ink-300">No live QMS connection exists. To add one, an adapter must be built against the system’s documented API and authorised credentials supplied — see docs/INTEGRATIONS.md. Nothing is scraped or written to company systems.</p>
      </Card>
      <Card title="AI-assisted photo review">
        <KV items={[["Status", <Badge key="a" tone={ai.configured ? "ok" : "neutral"} label={ai.configured ? "Enabled" : "Not configured"} />], ["Provider", ai.provider === "openai" ? "OpenAI" : "Anthropic"], ["Model", ai.configured ? ai.model : "—"], ["Detail", ai.reason ?? "Produces draft captions and possible observations only. Inspectors decide."]]} />
      </Card>
      <Card title="File storage">
        <KV
          items={[
            ["Driver", { s3: "S3-compatible object storage", "netlify-blobs": "Netlify Blobs (private)", "vercel-blob": "Vercel Blob (private)" }[driver] ?? "Local disk (server)"],
            ["Location", driver === "s3" ? `Bucket ${process.env.S3_BUCKET ?? "(not set)"}${process.env.S3_ENDPOINT ? " at custom endpoint" : ""}` : driver === "local" ? process.env.STORAGE_DIR ?? "./storage" : "Managed by the hosting platform"],
            ["Access", "Private. Files are served only to signed-in users through permission-checked routes."],
          ]}
        />
        {driver === "s3" && <p className="mt-3 text-xs text-warn-400">The S3 driver is implemented but has not been tested against a live bucket in this installation.</p>}
      </Card>
      <Card title="Database and email">
        <KV items={[["Database", dbStatus], ["Email notifications", "Not configured — no emails are sent. Reminders are in-app only."], ["Reminder scan", "Runs automatically on page load (at most every 10 min) and via npm run notifications:run"]]} />
      </Card>
    </div>
  );
}

async function DataTab() {
  const counts = await demoCounts();
  const totalDemo = counts.reduce((s, c) => s + c.demo, 0);
  const demoPhotosMissing = (await db.project.count({ where: { isDemo: true } })) > 0 && (await db.photo.count({ where: { isDemo: true } })) === 0;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card title="Records by source" pad={false}>
        <table className="tbl">
          <thead><tr><th>Table</th><th className="text-right">Real records</th><th className="text-right">Demo records</th></tr></thead>
          <tbody>
            {counts.map((c) => (
              <tr key={c.label}><td>{c.label}</td><td className="text-right tabular-nums">{c.real}</td><td className={`text-right tabular-nums ${c.demo ? "text-gold-300" : ""}`}>{c.demo}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="space-y-4">
      {demoPhotosMissing && (
        <Card title="Demo photographs">
          <ActionForm action={loadDemoPhotosAction} submit="Load demo photos" submitClass="btn-secondary">
            <p className="text-sm text-ink-200">The demo projects have no photos yet (hosted builds cannot create files). This adds 11 generated placeholder images, clearly marked DEMO, to the demo projects.</p>
          </ActionForm>
        </Card>
      )}
      <Card title="Remove demo data">
        {totalDemo === 0 ? (
          <p className="text-sm text-ink-300">No demo records are present.</p>
        ) : (
          <ActionForm action={purgeDemoAction} submit="Delete all demo data" submitClass="btn-danger" confirm="Permanently delete all DEMO records and their files?">
            <p className="text-sm text-ink-200">Deletes the {totalDemo} records flagged DEMO and their generated files, and deactivates the @example.com demo accounts. Real records are never touched; the purge is refused if real records are linked to demo projects. The activity log keeps a record of the purge.</p>
            <Fields cols={1} fields={[{ name: "confirm", label: 'Type "DELETE DEMO DATA" to confirm', required: true }]} />
          </ActionForm>
        )}
      </Card>
      </div>
    </div>
  );
}
