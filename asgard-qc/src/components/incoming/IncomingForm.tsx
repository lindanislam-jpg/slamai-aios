"use client";

import { upload } from "@vercel/blob/client";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createIncomingAction } from "@/app/(app)/incoming/actions";

type Opt = { value: string; label: string };
interface Pending { key: string; file: File; preview: string | null; error?: string }

const ACCEPT = ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif";
const CATEGORY = "Incoming materials";

/** One step for goods-in: job number, what arrived, the result and the photos. */
export function IncomingForm({ projects, maxFileMb, maxFiles, direct, defaultProjectId }: { projects: Opt[]; maxFileMb: number; maxFiles: number; direct: boolean; defaultProjectId?: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; code: string; photos: number; failed: string[]; ncr: string | null; submitted: boolean } | null>(null);

  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);

  function add(list: FileList | null) {
    if (!list) return;
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (files.some((f) => f.key === key) || next.some((f) => f.key === key)) continue;
      const okType = /\.(jpe?g|png|heic|heif)$/i.test(file.name) || /^image\/(jpeg|png|heic|heif)$/.test(file.type);
      const err = !okType ? "Not a JPG, PNG or HEIC file" : file.size > maxFileMb * 1_048_576 ? `Larger than ${maxFileMb} MB` : file.size === 0 ? "Empty file" : undefined;
      next.push({ key, file, preview: !err && /jpe?g|png/i.test(file.type) ? URL.createObjectURL(file) : null, error: err });
    }
    setFiles((cur) => [...cur, ...next].slice(0, maxFiles));
  }

  async function sendPhotos(projectId: string, inspectionId: string, caption: string, valid: Pending[]) {
    const failed: string[] = [];
    let stored = 0;
    const meta = { projectId, inspectionId, category: CATEGORY, inspectionType: "INCOMING_MATERIAL", caption };
    for (const [i, p] of valid.entries()) {
      setBusy(`Uploading photo ${i + 1} of ${valid.length}…`);
      try {
        let res: Response;
        if (direct) {
          const found = /\.([a-z0-9]{1,5})$/i.exec(p.file.name)?.[1].toLowerCase() ?? "";
          const key = `photo-uploads/${projectId}/${crypto.randomUUID()}.${["jpg", "jpeg", "png", "heic", "heif"].includes(found) ? found : "jpg"}`;
          await upload(key, p.file, { access: "private", handleUploadUrl: "/api/photos/blob", multipart: p.file.size > 8 * 1_048_576 });
          res = await fetch("/api/photos/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...meta, key, fileName: p.file.name }) });
        } else {
          const fd = new FormData();
          for (const [k, v] of Object.entries(meta)) fd.append(k, v);
          fd.append("files", p.file, p.file.name);
          res = await fetch("/api/photos/upload", { method: "POST", body: fd });
        }
        const body = await res.json().catch(() => ({}));
        const r = body.result ?? body.results?.[0];
        if (res.ok && r?.ok) stored++;
        else failed.push(`${p.file.name}: ${r?.error ?? body.error ?? `upload failed (${res.status})`}`);
      } catch (e) {
        failed.push(`${p.file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    return { stored, failed };
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) ?? "");
    const valid = files.filter((f) => !f.error);
    setBusy("Saving…");
    try {
      const r = await createIncomingAction({ projectId: get("projectId"), delivered: get("delivered"), supplier: get("supplier"), deliveryNote: get("deliveryNote"), result: get("result"), notes: get("notes") });
      if (!r.ok) return setError(r.error);
      const up = await sendPhotos(get("projectId"), r.id, get("delivered"), valid);
      setDone({ id: r.id, code: r.code, photos: up.stored, failed: up.failed, ncr: r.ncr, submitted: r.submitted });
      setFiles([]);
      form.reset();
      router.refresh();
    } catch {
      setError("Network error. Check the list below before trying again, so the delivery is not recorded twice.");
    } finally {
      setBusy("");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="in-projectId">Job number<span className="text-gold-400"> *</span></label>
          <select id="in-projectId" name="projectId" className="input" required defaultValue={defaultProjectId ?? ""}>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="in-delivered">What was delivered<span className="text-gold-400"> *</span></label>
          <input id="in-delivered" name="delivered" className="input" required maxLength={200} placeholder="e.g. 12 lengths SHS 100×100×5" />
        </div>
        <div>
          <label className="label" htmlFor="in-supplier">Supplier</label>
          <input id="in-supplier" name="supplier" className="input" maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="in-deliveryNote">Delivery note / PO number</label>
          <input id="in-deliveryNote" name="deliveryNote" className="input" maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="in-result">Result</label>
          <select id="in-result" name="result" className="input" defaultValue="PENDING">
            <option value="PENDING">Not decided yet (save as draft)</option>
            <option value="PASS">Pass — accepted as delivered</option>
            <option value="FAIL">Fail — damaged, wrong or short</option>
            <option value="HOLD">Hold — awaiting certificate or decision</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="in-notes">Notes</label>
          <input id="in-notes" name="notes" className="input" maxLength={2000} placeholder="What you checked and what you found" />
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-ink-500 bg-ink-900/60 px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary cursor-pointer"><Camera className="h-4 w-4" />Take photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="btn-secondary cursor-pointer"><Upload className="h-4 w-4" />Choose pictures
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          <span className="text-xs text-ink-300">{files.length ? `${files.filter((f) => !f.error).length} picture(s) ready` : `JPG, PNG or HEIC · up to ${maxFileMb} MB each · originals are stored unchanged`}</span>
        </div>
        {files.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {files.map((f) => (
              <li key={f.key} className={`relative overflow-hidden rounded-lg border ${f.error ? "border-bad-600" : "border-ink-600"}`}>
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={f.file.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-ink-700 p-1 text-center text-[10px] text-ink-300">{f.error ?? "HEIC — no preview"}</div>
                )}
                <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))} className="absolute right-1 top-1 rounded bg-ink-950/80 px-1.5 text-xs text-ink-100" aria-label={`Remove ${f.file.name}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={!!busy}>{busy || "Save incoming inspection"}</button>
        {error && <span role="alert" className="text-sm text-bad-400">{error}</span>}
      </div>

      {done && (
        <div role="status" className="rounded-lg border border-ok-600/40 bg-ok-600/10 px-4 py-3 text-sm text-ink-100">
          <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok-400" /><Link className="link font-medium" href={`/inspections/${done.id}`}>{done.code}</Link> saved with {done.photos} picture(s){done.submitted ? " and submitted for review" : " as a draft"}.{done.ncr ? ` ${done.ncr} was raised automatically for the Quality Manager.` : ""}</p>
          {done.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-bad-400">{done.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
          {done.failed.length > 0 && <p className="mt-1 text-xs text-ink-300">The inspection is saved. Open it to add the missing pictures.</p>}
        </div>
      )}
    </form>
  );
}
