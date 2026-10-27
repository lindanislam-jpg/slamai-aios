import { ActionForm } from "@/components/ActionForm";
import { Fields } from "@/components/fields";
import { Badge, Card, fmtDateTime, PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { PERMISSIONS, permissionsFor, ROLE_LABELS } from "@/lib/permissions";
import { listUsers } from "@/lib/services/users";
import { MIN_PASSWORD_LENGTH } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";
import type { Role } from "@prisma/client";

export const metadata = { title: "User Management" };

const roleOptions = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export default async function UsersPage() {
  const actor = await requirePagePermission("users.manage");
  const [users, overrides] = await Promise.all([listUsers(actor), getSetting("rolePermissions")]);

  return (
    <div className="space-y-5">
      <PageHeader title="User Management" subtitle="Accounts and roles. Changing a role or deactivating a user signs them out immediately." />
      <Card title={`Users (${users.length})`} pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role / active</th><th>Last sign-in</th><th>Reset password</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td className="whitespace-nowrap font-medium">{u.name}{u.id === actor.id && <span className="ml-1 text-xs text-ink-300">(you)</span>}<div>{u.active ? <Badge tone="ok" label="Active" /> : <Badge tone="neutral" label="Inactive" />}</div></td>
                  <td className="text-ink-200">{u.email}</td>
                  <td>
                    <ActionForm action={updateUserAction.bind(null, u.id)} submit="Update" submitClass="btn-secondary btn-sm" inline>
                      <select name="role" defaultValue={u.role} className="input w-auto py-1.5 text-xs" aria-label={`Role for ${u.name}`}>
                        {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-ink-200"><input type="checkbox" name="active" defaultChecked={u.active} className="accent-[#c39a45]" />Active</label>
                    </ActionForm>
                  </td>
                  <td className="whitespace-nowrap text-ink-300">{fmtDateTime(u.lastLoginAt)}</td>
                  <td>
                    <ActionForm action={resetPasswordAction.bind(null, u.id)} submit="Reset" submitClass="btn-ghost btn-sm" inline resetOnSuccess confirm={`Reset the password for ${u.email}?`}>
                      <input name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required placeholder="New temporary password" autoComplete="new-password" className="input w-48 py-1.5 text-xs" aria-label={`New password for ${u.name}`} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Add user">
          <ActionForm action={createUserAction} submit="Create user" resetOnSuccess>
            <Fields
              fields={[
                { name: "name", label: "Full name", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "role", label: "Role", type: "select", options: roleOptions, required: true },
                { name: "password", label: "Temporary password", type: "password", required: true, hint: `At least ${MIN_PASSWORD_LENGTH} characters. Share it securely; the user can change it under My account.` },
              ]}
            />
          </ActionForm>
        </Card>
        <Card title="What each role can do">
          <div className="space-y-3 text-sm">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
              const perms = [...permissionsFor(r, overrides)];
              return (
                <details key={r} className="rounded-lg border border-ink-600 px-3 py-2">
                  <summary className="cursor-pointer font-medium text-ink-100">{ROLE_LABELS[r]} <span className="text-xs text-ink-300">· {perms.length} permissions{overrides?.[r] ? " · customised" : ""}</span></summary>
                  <ul className="mt-2 grid gap-1 text-xs text-ink-200 sm:grid-cols-2">
                    {perms.map((p) => <li key={p}>• {PERMISSIONS[p]}</li>)}
                  </ul>
                </details>
              );
            })}
            <p className="text-xs text-ink-300">Adjust permissions in Settings → Permissions.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
