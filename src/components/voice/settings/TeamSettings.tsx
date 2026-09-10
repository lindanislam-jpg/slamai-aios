"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Trash2, UserPlus } from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, CardHeader, CopyButton, ErrorState, Field, Input, Loading,
  Modal, Select, Table, Td, Th,
} from "../ui";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, canAssignRole, type Role } from "@/lib/voice/roles";

type Member = {
  id: string; role: string; userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
};

type Invitation = { id: string; email: string; role: string; expiresAt: string };

export default function TeamSettings() {
  const { data, loading, error, refresh } = useApi<{
    members: Member[]; invitations: Invitation[]; yourRole: string; yourUserId: string;
  }>("/api/v1/team");
  const [inviting, setInviting] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  async function changeRole(id: string, role: string) {
    try {
      await api(`/api/v1/team/${id}`, "PATCH", { role });
      toast.success("Role updated");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/v1/team/${id}`, "DELETE");
      toast.success("Removed from this workspace");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Your team"
          description="Everyone who can see your calls and leads."
          action={<Button size="sm" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setInviting(true)}>Invite</Button>}
        />
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => {
              const isYou = member.userId === data.yourUserId;
              const canEdit = canAssignRole(data.yourRole, member.role) || (data.yourRole === "owner" && !isYou);
              return (
                <tr key={member.id} className="transition-colors hover:bg-white/[0.02]">
                  <Td>
                    <div className="font-medium text-slate-200">
                      {member.user.name ?? member.user.email}
                      {isYou && <span className="ml-2 text-[12px] text-slate-500">(you)</span>}
                    </div>
                    <div className="text-[12px] text-slate-500">{member.user.email}</div>
                  </Td>
                  <Td>
                    {canEdit ? (
                      <Select
                        value={member.role}
                        onChange={(e) => changeRole(member.id, e.target.value)}
                        className="w-auto min-w-[130px] py-1.5 text-[13px]"
                        aria-label={`Role for ${member.user.email}`}
                      >
                        {ROLES.filter((r) => canAssignRole(data.yourRole, r) || r === member.role).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={member.role === "owner" ? "brand" : "neutral"}>
                        {ROLE_LABELS[member.role as Role] ?? member.role}
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    {canEdit && !isYou && (
                      <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(member.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {data.invitations.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Waiting to accept
            </div>
            {data.invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                <span className="text-slate-300">{invitation.email}</span>
                <Badge tone="neutral">{ROLE_LABELS[invitation.role as Role] ?? invitation.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="What each role can do" description="Enforced on the server, not just hidden in the interface." />
        <div className="divide-y divide-white/[0.04]">
          {ROLES.map((role) => (
            <div key={role} className="px-5 py-3">
              <div className="text-[13.5px] font-medium text-slate-200">{ROLE_LABELS[role]}</div>
              <div className="mt-0.5 text-[12.5px] text-slate-400">{ROLE_DESCRIPTIONS[role]}</div>
            </div>
          ))}
        </div>
      </Card>

      <InviteModal open={inviting} onClose={() => setInviting(false)} yourRole={data.yourRole} onInvited={refresh} />
    </>
  );
}

function InviteModal({
  open,
  onClose,
  yourRole,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  yourRole: string;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function invite() {
    setSaving(true);
    try {
      const result = await api<{ inviteLink?: string; note?: string; added?: boolean }>(
        "/api/v1/team/invite",
        "POST",
        { email: email.trim(), role }
      );
      if (result.added) {
        toast.success("Added to your team");
        onInvited();
        onClose();
      } else {
        setLink(result.inviteLink ?? null);
        setNote(result.note ?? null);
        onInvited();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setLink(null);
    setNote(null);
    setEmail("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite someone"
      description="They'll see your calls, leads and appointments according to their role."
      footer={
        link ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={saving} disabled={!email.trim()} onClick={invite}>Send invite</Button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-3">
          <p className="text-[13.5px] text-slate-300">{note}</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <code className="block break-all font-mono text-[12px] text-slate-300">{link}</code>
          </div>
          <CopyButton value={link} label="Copy invite link" />
          <p className="text-[12px] text-slate-500">The link expires in seven days and works once.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Their email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.ie" />
          </Field>
          <Field label="Role" hint={ROLE_DESCRIPTIONS[role as Role]}>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.filter((r) => canAssignRole(yourRole, r)).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
