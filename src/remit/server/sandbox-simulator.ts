import "server-only";
import { db } from "@/lib/db";
import { settings } from "../config/settings";
import { forbidden } from "./api";
import { markPaymentReceived, markPayoutPaid } from "./transfer-service";
import type { RemitTransfer } from "@prisma/client";

/**
 * Sandbox transfer simulator.
 *
 * Drives a sandbox transfer forward one step at a time so the full customer
 * journey can be demonstrated end to end. It does this by calling the *same*
 * functions the real provider webhooks call — it does not write statuses
 * itself, so the demo exercises the real state machine, the real event log and
 * the real notifications.
 *
 * Two independent guards: demo mode must be on, and the transfer itself must be
 * a sandbox transfer. A live transfer can never be advanced from here.
 */

/** Minimum dwell time per step, so a demo reads as a process, not a flash. */
const STEP_DELAY_MS = 2_000;

export interface SimulationResult {
  status: string;
  advanced: boolean;
  /** Set when the step was refused because the previous one is still settling. */
  waitMs?: number;
}

export async function advanceSandboxTransfer(transferId: string): Promise<SimulationResult> {
  const transfer = await db.remitTransfer.findUniqueOrThrow({ where: { id: transferId } });

  if (!settings.demoMode) throw forbidden("Demo mode is not enabled");
  if (!transfer.isDemo) throw forbidden("This is not a sandbox transfer");

  const sinceLastChange = Date.now() - transfer.updatedAt.getTime();
  if (sinceLastChange < STEP_DELAY_MS) {
    return {
      status: transfer.status,
      advanced: false,
      waitMs: STEP_DELAY_MS - sinceLastChange,
    };
  }

  const next = await step(transfer);
  return { status: next.status, advanced: next.status !== transfer.status };
}

async function step(transfer: RemitTransfer): Promise<RemitTransfer> {
  switch (transfer.status) {
    case "PROCESSING": {
      const payment = await db.remitPayment.findFirst({
        where: { transferId: transfer.id },
        orderBy: { createdAt: "desc" },
      });
      return markPaymentReceived(transfer.id, {
        providerRef: payment?.providerRef ?? undefined,
        providerFeeMinor: payment?.providerFeeMinor,
      });
    }

    case "SENT": {
      const payout = await db.remitPayout.findFirst({
        where: { transferId: transfer.id },
        orderBy: { createdAt: "desc" },
      });
      return markPayoutPaid(transfer.id, {
        providerRef: payout?.providerRef ?? undefined,
        providerCostMinor: payout?.providerCostMinor,
      });
    }

    // PENDING waits on the payment being initiated; COMPLIANCE_REVIEW waits on
    // a human decision in the admin dashboard — the simulator must not make
    // that decision for them, which is the point of the review workflow.
    default:
      return transfer;
  }
}
