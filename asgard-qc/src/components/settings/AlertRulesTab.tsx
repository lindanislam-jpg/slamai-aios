import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, fmtDateTime } from "@/components/ui";
import { updateRuleAction } from "@/app/(app)/alerts/actions";
import { db } from "@/lib/db";
import { ALERT_CATEGORIES, loadRules, RULE_CATALOGUE } from "@/lib/services/alert-rules";

/** Administrators enable/disable rules and set severity and thresholds.
 *  Every change increments the rule version and is written to the audit trail. */
export async function AlertRulesTab() {
  await loadRules();
  const [rules, changes] = await Promise.all([
    db.alertRule.findMany({ orderBy: [{ name: "asc" }] }),
    db.auditEvent.findMany({ where: { action: "alert.rule" }, orderBy: { at: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-gold-600/40 bg-gold-600/5 px-4 py-2 text-xs text-gold-300">
        Default thresholds are starting points, not company standards. Confirm each threshold with the Quality Manager for the operation it applies to. Rules are deterministic and explain which records triggered each alert. Reminder periods for NCRs, NDT, calibration and audit findings are under Limits &amp; reminders.
      </div>
      {ALERT_CATEGORIES.map((cat) => (
        <Card key={cat} title={cat}>
          <div className="space-y-3">
            {rules.filter((r) => r.category === cat && RULE_CATALOGUE[r.key]).map((r) => {
              const def = RULE_CATALOGUE[r.key];
              const params = (r.params as Record<string, number> | null) ?? {};
              return (
                <details key={r.key} className="rounded border border-ink-600 p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ink-100">{r.name}</span>
                    <Badge value={r.severity} />
                    {!r.enabled && <Badge value="DISABLED" tone="neutral" label="Disabled" />}
                    <span className="text-xs text-ink-300">v{r.version}{r.updatedByName ? ` · ${r.updatedByName}` : ""}</span>
                  </summary>
                  <p className="mt-2 text-xs text-ink-200">{def.description.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? def.params?.[k]?.value ?? k))}</p>
                  <div className="mt-3">
                    <ActionForm action={updateRuleAction.bind(null, r.key)} submit="Save rule" submitClass="btn-secondary btn-sm">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm text-ink-200"><input type="checkbox" name="enabled" defaultChecked={r.enabled} /> Enabled</label>
                        <label className="text-xs text-ink-300">Severity
                          <select name="severity" defaultValue={r.severity} className="input mt-1">
                            {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                          </select>
                        </label>
                        {Object.entries(def.params ?? {}).map(([k, meta]) => (
                          <label key={k} className="text-xs text-ink-300">{meta.label}
                            <input name={`p.${k}`} type="number" min={0} max={3650} step={1} required defaultValue={params[k] ?? meta.value} className="input mt-1" />
                          </label>
                        ))}
                      </div>
                    </ActionForm>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ))}
      <Card title="Rule change history">
        {changes.length ? (
          <ul className="space-y-1 text-sm">
            {changes.map((c) => (
              <li key={c.id}><span className="text-ink-300">{fmtDateTime(c.at)}</span> · {c.actorName} · {c.summary} <span className="text-xs text-ink-300">{JSON.stringify(c.before)} → {JSON.stringify(c.after)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-300">No rule changes yet — all rules use their defaults.</p>
        )}
      </Card>
    </div>
  );
}
