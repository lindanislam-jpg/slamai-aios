"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, SandboxBadge } from "./ui";

/**
 * Identity verification.
 *
 * The real flow is owned by the KYC provider: we start a session, send the
 * customer to the provider's hosted flow, and record the decision that comes
 * back on their webhook. There is no code path that marks a customer verified
 * on their own say-so.
 *
 * In sandbox mode a decision button stands in for that webhook, so the journey
 * is completable. It is gated server-side on demo mode AND the sandbox provider
 * being the configured one.
 */
export function IdentityVerification({
  kycStatus,
  isSandbox,
}: {
  kycStatus: string;
  isSandbox: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(kycStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/remit/kyc", { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data?.error?.message ?? "We could not start verification");
      return;
    }
    setStatus(data.status);
    setStarted(true);
    // A live provider returns a hosted URL to send the customer to.
    if (data.verificationUrl && !isSandbox) window.location.href = data.verificationUrl;
  }

  async function sandboxDecision(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/remit/kyc/sandbox-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data?.error?.message ?? "That did not work");
      return;
    }
    setStatus(data.kycStatus);
    router.refresh();
    if (data.kycStatus === "APPROVED") router.push("/send/home");
  }

  if (status === "APPROVED") {
    return (
      <Card>
        <div className="text-center">
          <span aria-hidden className="text-[40px]">
            ✅
          </span>
          <h1 className="mt-2 text-[22px] font-bold text-send-ink">You are verified</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-send-body">
            Your identity check is complete. You can send money without transfers being held for
            review.
          </p>
          <Button className="mt-5 w-full" onClick={() => router.push("/send/new")}>
            Send money
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-send-ink">Verify your identity</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-send-body">
          Money transfer businesses are required to verify who their customers are before sending
          funds abroad. It takes a couple of minutes and only needs doing once.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {status === "REJECTED" && (
        <Alert tone="danger" title="Verification was not successful">
          We could not verify your identity from the documents provided. Contact support and we will
          look at it with you.
        </Alert>
      )}

      <ul className="space-y-2.5">
        {[
          ["Photo ID", "A passport, driving licence or national ID card."],
          ["A selfie", "So the provider can match you to your document."],
          ["Your address", "Confirmed against the details on your profile."],
        ].map(([title, body]) => (
          <li key={title} className="flex gap-3 rounded-xl border border-send-line p-3.5">
            <span aria-hidden className="text-[18px]">
              •
            </span>
            <div>
              <div className="text-[14px] font-bold text-send-ink">{title}</div>
              <div className="text-[13px] leading-relaxed text-send-body">{body}</div>
            </div>
          </li>
        ))}
      </ul>

      {!started ? (
        <Button size="lg" className="w-full" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start verification"}
        </Button>
      ) : isSandbox ? (
        <div className="rounded-xl border border-send-accent/40 bg-send-accent-soft p-4">
          <div className="flex items-center gap-2">
            <SandboxBadge />
            <span className="text-[12px] font-bold text-send-warning">
              No identity provider is connected
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-send-warning">
            In production you would be handed to the verification provider&apos;s hosted flow and
            the result would arrive on their webhook. For this sandbox, choose the outcome you want
            to see.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="md"
              className="flex-1"
              onClick={() => sandboxDecision("APPROVED")}
              disabled={busy}
            >
              Simulate approval
            </Button>
            <Button
              size="md"
              variant="secondary"
              className="flex-1"
              onClick={() => sandboxDecision("REJECTED")}
              disabled={busy}
            >
              Simulate rejection
            </Button>
          </div>
        </div>
      ) : (
        <Alert tone="info">Redirecting you to our verification partner…</Alert>
      )}

      <p className="text-[12px] leading-relaxed text-send-muted">
        Your documents go directly to the verification provider. This application stores only the
        outcome and a reference, never your ID images.
      </p>
    </Card>
  );
}
