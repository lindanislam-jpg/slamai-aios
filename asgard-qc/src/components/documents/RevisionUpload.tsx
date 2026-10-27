"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Upload a new document revision (file optional). Posts multipart to the
 *  revisions route so large files never go through a server action. */
export function RevisionUpload({ documentId, suggested }: { documentId: string; suggested?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setMsg(null);
        try {
          const res = await fetch(`/api/documents/${documentId}/revisions`, { method: "POST", body: new FormData(form) });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body.ok) {
            setMsg({ ok: true, text: `Revision ${body.revision} uploaded — under review.` });
            form.reset();
            router.refresh();
          } else setMsg({ ok: false, text: body.error ?? `Upload failed (${res.status}).` });
        } catch {
          setMsg({ ok: false, text: "Network error — nothing was saved." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="w-24">
        <label className="label" htmlFor={`rev-${documentId}`}>Revision</label>
        <input id={`rev-${documentId}`} name="revision" required className="input" placeholder={suggested} />
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="label" htmlFor={`notes-${documentId}`}>Change notes</label>
        <input id={`notes-${documentId}`} name="notes" className="input" />
      </div>
      <div className="min-w-[220px]">
        <label className="label" htmlFor={`file-${documentId}`}>File (PDF, image, DOCX, XLSX — optional)</label>
        <input id={`file-${documentId}`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="block w-full text-xs text-ink-200 file:mr-2 file:rounded file:border-0 file:bg-ink-600 file:px-2 file:py-1.5 file:text-ink-100" />
      </div>
      <button className="btn-secondary" disabled={busy}>{busy ? "Uploading…" : "Upload revision"}</button>
      {msg && <span role="status" className={msg.ok ? "text-sm text-ok-400" : "text-sm text-bad-400"}>{msg.text}</span>}
    </form>
  );
}
