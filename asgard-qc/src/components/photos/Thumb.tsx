import clsx from "clsx";
import { ImageOff } from "lucide-react";

/** Authenticated thumbnail, or a placeholder when the server could not make
 *  a preview (e.g. HEVC-encoded HEIC). */
export function Thumb({ id, hasThumb, alt, className }: { id: string; hasThumb: boolean; alt: string; className?: string }) {
  if (!hasThumb)
    return (
      <div className={clsx("flex flex-col items-center justify-center gap-1 bg-ink-700 text-center text-[11px] text-ink-300", className)}>
        <ImageOff className="h-5 w-5" />
        No preview (HEIC)
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/files/photo/${id}?size=thumb`} alt={alt} loading="lazy" className={clsx("bg-ink-700 object-cover", className)} />;
}

export function PhotoDate({ takenAt, uploadedAt }: { takenAt: Date | null; uploadedAt: Date }) {
  const f = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return takenAt ? (
    <span title="Capture time from the image file">Taken {f(takenAt)}</span>
  ) : (
    <span className="text-warn-400" title="The file had no capture date; upload time shown">Uploaded {f(uploadedAt)} (no capture date)</span>
  );
}
