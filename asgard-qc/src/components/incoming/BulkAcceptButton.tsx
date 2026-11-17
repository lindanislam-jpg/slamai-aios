"use client";

import { CheckCheck } from "lucide-react";
import { useFormStatus } from "react-dom";

/** Submit button for the ticked deliveries, with a confirmation that says exactly what happens. */
export function BulkAcceptButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
    <button
      type="button"
      className="btn-secondary"
      onClick={(e) => {
        const boxes = e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? [];
        const allOn = Array.from(boxes).every((b) => b.checked);
        boxes.forEach((b) => { b.checked = !allOn; });
      }}
    >Tick / untick all drafts shown</button>
    <button
      type="submit"
      className="btn-primary"
      disabled={pending}
      onClick={(e) => {
        const form = e.currentTarget.form;
        const n = form ? form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length : 0;
        if (!n) { e.preventDefault(); alert("Tick the draft records you have checked first."); return; }
        if (!confirm(`Accept ${n} deliveries as Pass?\n\nOnly do this for deliveries you have checked (photos looked at, nothing damaged, wrong or short). Each record is set to Pass in your name, its open checklist lines are answered Pass, and it is submitted for review. This is recorded in the audit trail.`)) e.preventDefault();
      }}
    >
      <CheckCheck className="h-4 w-4" />{pending ? "Saving…" : "Accept ticked as Pass"}
    </button>
    </div>
  );
}
