"use client";

import { useState } from "react";

/** A photo thumbnail that shows a neat placeholder (not the caption text) when the image cannot be loaded. */
export function ThumbImg({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex aspect-[4/3] w-full items-center justify-center bg-ink-700 p-1 text-center text-[10px] text-ink-300" title={label}>Preview unavailable</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" title={label} onError={() => setFailed(true)} className="aspect-[4/3] w-full bg-ink-700 object-cover transition group-hover:opacity-80" loading="lazy" />;
}
