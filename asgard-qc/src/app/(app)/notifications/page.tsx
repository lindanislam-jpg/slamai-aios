import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, Empty, fmtDateTime, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { str, type SP } from "@/lib/params";
import { listNotifications, NOTIFICATION_KINDS } from "@/lib/services/notifications";
import { markReadAction, muteAction, scanAction } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const all = str(sp, "show") === "all";
  const [items, user, last] = await Promise.all([
    listNotifications(actor, { includeRead: all }),
    db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { notificationPrefs: true } }),
    db.setting.findUnique({ where: { key: "lastNotificationScan" } }),
  ]);
  const muted = new Set(((user.notificationPrefs as { muted?: string[] } | null)?.muted ?? []) as string[]);
  const canScan = actor.permissions.has("settings.manage") || actor.permissions.has("ncr.manage");
  const unread = items.filter((n) => !n.readAt);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={<>In-app reminders only — no emails are sent. Last scan: {last ? fmtDateTime(last.value as string) : "never"}.</>}
        actions={
          <>
            <Link className="btn-ghost" href={all ? "/notifications" : "/notifications?show=all"}>{all ? "Show unread" : "Show read too"}</Link>
            {unread.length > 0 && <ActionForm action={markReadAction.bind(null, "all")} submit="Mark all read" submitClass="btn-secondary" inline />}
            {canScan && <ActionForm action={scanAction} submit="Run reminder scan now" submitClass="btn-secondary" inline />}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title={`${all ? "All open" : "Unread"} reminders (${items.length})`} pad={false}>
          {items.length ? (
            <ul className="divide-y divide-ink-600/70">
              {items.map((n) => (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? "opacity-60" : ""}`}>
                  <Badge value={n.severity} tone={n.severity === "critical" ? "bad" : n.severity === "warning" ? "warn" : "info"} label={n.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-ink-100">{n.href ? <Link className="hover:underline" href={n.href}>{n.title}</Link> : n.title}</div>
                    {n.body && <div className="text-xs text-ink-300">{n.body}</div>}
                    <div className="text-[11px] text-ink-400">{NOTIFICATION_KINDS[n.kind]?.label ?? n.kind} · {fmtDateTime(n.createdAt)}</div>
                  </div>
                  {!n.readAt && <ActionForm action={markReadAction.bind(null, [n.id])} submit="Mark read" submitClass="btn-ghost btn-sm" inline />}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4"><Empty title={all ? "No open reminders" : "You're up to date"} /></div>
          )}
        </Card>
        <Card title="Which reminders I receive">
          <ActionForm action={muteAction} submit="Save preferences">
            <p className="text-xs text-ink-300">Tick a reminder type to mute it. You only receive types relevant to your role.</p>
            <div className="space-y-2">
              {Object.entries(NOTIFICATION_KINDS)
                .filter(([, k]) => actor.permissions.has(k.audience))
                .map(([key, k]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-ink-100">
                    <input type="checkbox" name="muted" value={key} defaultChecked={muted.has(key)} className="h-4 w-4 accent-[#c39a45]" />
                    Mute: {k.label}
                  </label>
                ))}
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
