"use client";

/**
 * Alarm subsystem.
 *
 * Browsers cannot guarantee that a web page wakes you up: there is no reliable
 * cross-browser scheduled-notification API, background timers are throttled or
 * frozen, and audio cannot start without a prior user gesture. This module does
 * the strongest thing the platform actually allows, and `alarmCapabilities()`
 * reports — truthfully — what is and is not guaranteed so the UI never claims
 * more than the browser can deliver.
 */

export interface AlarmCapabilities {
  notifications: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  serviceWorker: boolean;
  /** Scheduled notifications that fire with the tab closed. Effectively Chromium-only, behind a flag. */
  scheduledNotifications: boolean;
  /** Whether an AudioContext is currently unlocked (a user gesture has happened). */
  audioUnlocked: boolean;
  standalone: boolean;
  wakeLock: boolean;
  vibrate: boolean;
}

export function alarmCapabilities(audioUnlocked: boolean): AlarmCapabilities {
  const hasNotification = typeof window !== "undefined" && "Notification" in window;
  return {
    notifications: hasNotification,
    notificationPermission: hasNotification ? Notification.permission : "unsupported",
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    scheduledNotifications:
      hasNotification && "showTrigger" in (Notification.prototype as unknown as Record<string, unknown>),
    audioUnlocked,
    standalone:
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true),
    wakeLock: typeof navigator !== "undefined" && "wakeLock" in navigator,
    vibrate: typeof navigator !== "undefined" && "vibrate" in navigator,
  };
}

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

type ToneKind = "wake" | "bed" | "chime";

/**
 * Synthesised alarm — no audio asset to ship, and it survives being rebuilt at
 * any volume. The wake tone is an insistent rising two-note figure; the bedtime
 * tone is a soft descending pair.
 */
export class AlarmSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private playing = false;

  get isPlaying() {
    return this.playing;
  }

  /** Must be called from a user gesture the first time to unlock audio. */
  async unlock(): Promise<boolean> {
    try {
      this.ensure();
      if (this.ctx?.state === "suspended") await this.ctx.resume();
      return this.ctx?.state === "running";
    } catch {
      return false;
    }
  }

  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  private ensure() {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  private blip(freq: number, at: number, duration: number, type: OscillatorType = "sine") {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.9, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  private pattern(kind: ToneKind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === "wake") {
      // Rising, deliberately hard to ignore.
      this.blip(659.25, t, 0.22, "triangle");
      this.blip(880, t + 0.26, 0.22, "triangle");
      this.blip(1174.66, t + 0.52, 0.3, "triangle");
    } else if (kind === "bed") {
      this.blip(523.25, t, 0.5, "sine");
      this.blip(392, t + 0.45, 0.7, "sine");
    } else {
      this.blip(880, t, 0.16, "sine");
      this.blip(1318.5, t + 0.12, 0.22, "sine");
    }
  }

  /** One-shot confirmation sound. */
  async ping(kind: ToneKind = "chime", volume = 0.5) {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.setVolume(volume);
    this.pattern(kind);
  }

  async start(kind: Exclude<ToneKind, "chime">, volume = 0.6) {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.setVolume(volume);
    this.stop();
    this.playing = true;
    this.pattern(kind);
    this.timer = window.setInterval(() => this.pattern(kind), kind === "wake" ? 1600 : 4200);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;
  }
}

let sharedSound: AlarmSound | null = null;
export function getAlarmSound(): AlarmSound {
  if (!sharedSound) sharedSound = new AlarmSound();
  return sharedSound;
}

/* ------------------------------------------------------------------ *
 * Notifications & service worker
 * ------------------------------------------------------------------ */

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/life-sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Fires a notification through the service worker when possible (required on Android). */
export async function fireNotification(title: string, body: string, tag = "life-alarm") {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/life-icon.svg",
    badge: "/life-icon.svg",
    requireInteraction: true,
    silent: false,
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported — the alarm still works visually and audibly */
  }
}

/** Keeps the screen awake while an alarm stage is on screen, where supported. */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return null;
    return await nav.wakeLock.request("screen");
  } catch {
    return null;
  }
}
