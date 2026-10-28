"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CmrAttachmentUpload({ cmrId, maxMb }: { cmrId: string; maxMb: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return setMsg({ ok: false, text: "Choose a file." });
    if (file.size > maxMb * 1_048_576) return setMsg({ ok: false, text: `Larger than ${maxMb} MB.` });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cmr/${cmrId}/attachments`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: body.error ?? "Upload failed." });
      setMsg({ ok: true, text: "Attached." });
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input type="file" name="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx" capture="environment" className="input max-w-xs text-xs" required />
      <input name="caption" className="input max-w-xs text-xs" placeholder="Caption (e.g. before repair)" />
      <button className="btn-secondary btn-sm" disabled={busy}>{busy ? "Uploading…" : "Attach"}</button>
      <span className="text-xs text-ink-300">Photos, PDF, Word, Excel · up to {maxMb} MB</span>
      {msg && <span className={msg.ok ? "text-xs text-ok-400" : "text-xs text-bad-400"} role="status">{msg.text}</span>}
    </form>
  );
}
