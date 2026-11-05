"use client";

/* The player.
 *
 * Streams are almost all HLS (.m3u8). Two playback paths:
 *   • Safari / iOS play HLS natively — hand the URL straight to <video>.
 *   • Everything else needs hls.js, which is loaded on demand (it is ~200 KB,
 *     so it must not sit in the main bundle).
 *
 * Live TV fails often and for boring reasons (channel moved, geo-block, host
 * down). The player treats failure as a normal state with a readable message
 * and a one-tap retry, instead of leaving a black rectangle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { useTv } from "@/lib/tv/store";
import type { Channel } from "@/lib/tv/types";
import { flag, pretty } from "@/lib/tv/sources";

type Status = "loading" | "playing" | "error";

export function Player({
  channel,
  onClose,
  onNext,
  onPrev,
}: {
  channel: Channel;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const { playbackUrl, isFavorite, toggleFavorite, markDead, state, updateSettings } = useTv();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(false);

  const src = playbackUrl(channel);

  /* ---- attach the stream ---- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    setStatus("loading");
    setMessage("");

    const fail = (text: string) => {
      if (disposed) return;
      setStatus("error");
      setMessage(text);
      markDead(channel.id);
    };

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    const looksHls = /\.m3u8(\?|$)/i.test(channel.url) || src.includes("/api/tv/proxy");

    /* The element is passed in rather than closed over: TypeScript drops the
       non-null narrowing inside a hoisted function body. */
    async function attach(el: HTMLVideoElement) {
      /* Non-HLS (raw .ts, .mp4, MPEG-DASH-less direct feeds) and Safari both
         go straight to the element. */
      if (!looksHls || nativeHls) {
        el.src = src;
        try {
          await el.play();
        } catch {
          /* Autoplay refused — the poster/controls still let the user start it. */
        }
        return;
      }

      const mod = await import("hls.js");
      const HlsCtor = mod.default;
      if (disposed) return;

      if (!HlsCtor.isSupported()) {
        fail("This browser cannot play HLS streams.");
        return;
      }

      const hls = new HlsCtor({
        lowLatencyMode: false,
        /* Live TV: keep the buffer modest so channel switches feel instant. */
        maxBufferLength: 20,
        manifestLoadingTimeOut: 15_000,
        fragLoadingTimeOut: 25_000,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;

      hls.on(HlsCtor.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case HlsCtor.ErrorTypes.NETWORK_ERROR:
            /* A manifest 4xx means the channel is gone or blocked; retrying
               a dead URL forever just burns battery. */
            if (data.details === "manifestLoadError" || data.details === "manifestParsingError") {
              fail(
                state.settings.useProxy
                  ? "This channel did not respond. It may be offline or blocked in your region."
                  : "This channel did not respond. Try turning the stream proxy on in Settings.",
              );
            } else {
              hls.startLoad();
            }
            break;
          case HlsCtor.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            fail("Playback failed for this channel.");
        }
      });

      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        void el.play().catch(() => undefined);
      });

      hls.loadSource(src);
      hls.attachMedia(el);
    }

    void attach(video).catch(() => fail("Could not start this channel."));

    const onPlaying = () => {
      if (!disposed) {
        setStatus("playing");
        setMessage("");
      }
    };
    const onElementError = () => fail("The stream could not be loaded.");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onElementError);

    return () => {
      disposed = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onElementError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, channel.id, channel.url, attempt, markDead, state.settings.useProxy]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* iPhone Safari refuses element fullscreen — the native video control
         handles it there, so there is nothing useful to report. */
    }
  }, []);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && onNext) onNext();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
      else if (e.key.toLowerCase() === "m") {
        const v = videoRef.current;
        if (v) {
          v.muted = !v.muted;
          setMuted(v.muted);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev, toggleFullscreen]);

  const fav = isFavorite(channel.id);

  return (
    <div className="tv-player-scrim" role="dialog" aria-modal="true" aria-label={`Watching ${channel.name}`}>
      <div className="tv-player" ref={shellRef}>
        <video
          ref={videoRef}
          className="tv-video"
          controls
          playsInline
          autoPlay
          muted={muted}
          poster={channel.logo}
        />

        {status === "loading" ? (
          <div className="tv-player-state">
            <div className="tv-spinner" aria-hidden />
            <p>Tuning in…</p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="tv-player-state">
            <p className="tv-player-error">{message}</p>
            <div className="tv-player-actions">
              <button className="tv-btn tv-btn-primary" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
              <button
                className="tv-btn"
                onClick={() => {
                  updateSettings({ useProxy: !state.settings.useProxy });
                  setAttempt((a) => a + 1);
                }}
              >
                {state.settings.useProxy ? "Retry without proxy" : "Retry with proxy"}
              </button>
              {onNext ? (
                <button className="tv-btn" onClick={onNext}>
                  Next channel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="tv-player-bar">
          <div className="tv-player-meta">
            {channel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote logo hosts
              <img src={channel.logo} alt="" className="tv-player-logo" loading="lazy" />
            ) : null}
            <div className="min-w-0">
              <div className="tv-player-name">{channel.name}</div>
              <div className="tv-player-sub">
                {[flag(channel.country), channel.group, channel.language ? pretty(channel.language) : null]
                  .filter(Boolean)
                  .join(" · ") || "Live"}
              </div>
            </div>
          </div>

          <div className="tv-player-controls">
            <button
              className="tv-icon-btn"
              onClick={() => toggleFavorite(channel.id)}
              aria-pressed={fav}
              title={fav ? "Remove from favourites" : "Add to favourites"}
            >
              {fav ? "★" : "☆"}
            </button>
            {onPrev ? (
              <button className="tv-icon-btn" onClick={onPrev} title="Previous channel (←)">
                ‹
              </button>
            ) : null}
            {onNext ? (
              <button className="tv-icon-btn" onClick={onNext} title="Next channel (→)">
                ›
              </button>
            ) : null}
            <button className="tv-icon-btn" onClick={() => void toggleFullscreen()} title="Fullscreen (F)">
              ⛶
            </button>
            <button className="tv-icon-btn" onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
