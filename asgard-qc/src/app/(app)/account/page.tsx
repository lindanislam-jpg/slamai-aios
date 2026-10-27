import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Card, fmtDateTime, KV, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/session";
import { changeOwnPassword } from "./actions";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const actor = await requireActor();
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { createdAt: true, lastLoginAt: true } });
  return (
    <div className="space-y-5">
      <PageHeader title="My account" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Profile">
          <KV items={[["Name", actor.name], ["Email", actor.email], ["Role", ROLE_LABELS[actor.role]], ["Last sign-in", fmtDateTime(user.lastLoginAt)], ["Account created", fmtDateTime(user.createdAt)]]} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ink-200">My permissions ({actor.permissions.size})</summary>
            <ul className="mt-2 grid gap-1 text-xs text-ink-300 sm:grid-cols-2">{[...actor.permissions].map((p) => <li key={p}>• {PERMISSIONS[p]}</li>)}</ul>
          </details>
          <p className="mt-3 text-xs text-ink-300">Name and role are managed by an administrator.</p>
        </Card>
        <Card title="Change password">
          <ActionForm action={changeOwnPassword} submit="Change password" resetOnSuccess>
            <Fields
              cols={1}
              fields={[
                { name: "current", label: "Current password", type: "password", required: true },
                { name: "password", label: "New password", type: "password", required: true, hint: `At least ${MIN_PASSWORD_LENGTH} characters. You will be signed out everywhere.` },
                { name: "confirm", label: "Confirm new password", type: "password", required: true },
              ]}
            />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
