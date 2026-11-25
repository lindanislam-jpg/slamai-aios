"use client";

import { useEffect, useState } from "react";

/**
 * The animated voice visual in the hero.
 *
 * Bar heights are generated once on the client after mount rather than during
 * render, so the server and client markup match and the page does not flash a
 * different waveform on hydration. It is decorative, so it is hidden from
 * assistive technology and stands still for anyone who prefers reduced motion.
 */
const BAR_COUNT = 44;

export default function VoiceWave() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div aria-hidden className="relative mb-6 flex h-28 items-center justify-center gap-[3px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d20]/80 px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 100% at 50% 50%, rgba(99,102,241,0.18), transparent)" }}
      />
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        // A smooth envelope so the wave is tallest in the middle, like speech.
        const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI);
        const base = 8 + envelope * 46;
        return (
          <span
            key={i}
            className="relative w-[3px] rounded-full bg-gradient-to-t from-indigo-600 to-cyan-400 motion-reduce:animate-none"
            style={{
              height: `${base}px`,
              opacity: 0.35 + envelope * 0.55,
              animation: mounted ? `slamai-wave ${(900 + (i % 7) * 130)}ms ease-in-out ${i * 40}ms infinite alternate` : undefined,
            }}
          />
        );
      })}
      <style>{`
        @keyframes slamai-wave {
          from { transform: scaleY(0.35); }
          to   { transform: scaleY(1.15); }
        }
      `}</style>
    </div>
  );
}
