/** Shared display labels and tones, so a call outcome reads the same everywhere. */

export const OUTCOME_LABELS: Record<string, string> = {
  booked: "Appointment booked",
  lead_captured: "Lead captured",
  transferred: "Transferred to a person",
  message_taken: "Message taken",
  info_only: "Question answered",
  answered: "Answered",
  missed: "Missed",
  failed: "Failed",
};

export type Tone = "success" | "brand" | "warning" | "info" | "neutral" | "danger";

export const OUTCOME_TONE: Record<string, Tone> = {
  booked: "success",
  lead_captured: "brand",
  transferred: "warning",
  message_taken: "info",
  info_only: "neutral",
  answered: "neutral",
  missed: "danger",
  failed: "danger",
};

export const LEAD_STATUSES = [
  { value: "new", label: "New", tone: "brand" as Tone },
  { value: "contacted", label: "Contacted", tone: "info" as Tone },
  { value: "qualified", label: "Qualified", tone: "warning" as Tone },
  { value: "booked", label: "Booked", tone: "success" as Tone },
  { value: "won", label: "Won", tone: "success" as Tone },
  { value: "lost", label: "Lost", tone: "neutral" as Tone },
];

export const APPOINTMENT_STATUSES = [
  { value: "pending", label: "Pending", tone: "warning" as Tone },
  { value: "confirmed", label: "Confirmed", tone: "success" as Tone },
  { value: "completed", label: "Completed", tone: "neutral" as Tone },
  { value: "cancelled", label: "Cancelled", tone: "danger" as Tone },
  { value: "no_show", label: "No show", tone: "danger" as Tone },
];

export function labelFor(list: { value: string; label: string }[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value.replace(/_/g, " ");
}

export function toneFor(list: { value: string; tone: Tone }[], value: string): Tone {
  return list.find((item) => item.value === value)?.tone ?? "neutral";
}
