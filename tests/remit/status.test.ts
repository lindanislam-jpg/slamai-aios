import { describe, expect, it } from "vitest";
import {
  assertTransition,
  buildTimeline,
  canTransition,
  InvalidTransferTransitionError,
  isCancellable,
  isTerminal,
  TRANSFER_STATUSES,
  type TransferStatus,
} from "@/remit/transfers/status";

describe("transfer state machine", () => {
  it("walks the happy path", () => {
    const path: TransferStatus[] = [
      "PENDING",
      "PROCESSING",
      "PAYMENT_RECEIVED",
      "CONVERTING",
      "SENT",
      "COMPLETED",
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("supports the compliance detour and rejoining the flow", () => {
    expect(canTransition("PAYMENT_RECEIVED", "COMPLIANCE_REVIEW")).toBe(true);
    expect(canTransition("COMPLIANCE_REVIEW", "CONVERTING")).toBe(true);
    expect(canTransition("COMPLIANCE_REVIEW", "FAILED")).toBe(true);
  });

  it("refuses to move backwards, so a replayed webhook cannot undo progress", () => {
    expect(canTransition("COMPLETED", "SENT")).toBe(false);
    expect(canTransition("SENT", "PAYMENT_RECEIVED")).toBe(false);
    expect(canTransition("PAYMENT_RECEIVED", "PENDING")).toBe(false);
  });

  it("locks terminal states", () => {
    for (const terminal of ["COMPLETED", "FAILED", "CANCELLED"] as TransferStatus[]) {
      expect(isTerminal(terminal)).toBe(true);
      for (const target of TRANSFER_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("never lets a transfer skip payment collection", () => {
    expect(canTransition("PENDING", "SENT")).toBe(false);
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
    expect(canTransition("PROCESSING", "COMPLETED")).toBe(false);
    expect(canTransition("PAYMENT_RECEIVED", "COMPLETED")).toBe(false);
  });

  it("throws a typed error on an illegal move", () => {
    expect(() => assertTransition("COMPLETED", "PENDING")).toThrow(InvalidTransferTransitionError);
    expect(() => assertTransition("PENDING", "PROCESSING")).not.toThrow();
  });

  it("only allows cancellation before the money is collected", () => {
    expect(isCancellable("PENDING")).toBe(true);
    expect(isCancellable("PROCESSING")).toBe(true);
    expect(isCancellable("PAYMENT_RECEIVED")).toBe(false);
    expect(isCancellable("SENT")).toBe(false);
    expect(isCancellable("COMPLETED")).toBe(false);
  });
});

describe("customer timeline", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 12, minutes));

  it("hides the compliance step for transfers that never entered review", () => {
    const timeline = buildTimeline("SENT", [
      { toStatus: "PENDING", createdAt: at(0) },
      { toStatus: "PROCESSING", createdAt: at(1) },
      { toStatus: "PAYMENT_RECEIVED", createdAt: at(2) },
      { toStatus: "CONVERTING", createdAt: at(3) },
      { toStatus: "SENT", createdAt: at(4) },
    ]);
    expect(timeline.map((step) => step.key)).toEqual([
      "initiated",
      "received",
      "converting",
      "sent",
      "paid",
    ]);
    expect(timeline.find((step) => step.key === "sent")?.state).toBe("current");
    expect(timeline.find((step) => step.key === "paid")?.state).toBe("upcoming");
  });

  it("shows the compliance step once a transfer has been through it", () => {
    const timeline = buildTimeline("COMPLIANCE_REVIEW", [
      { toStatus: "PENDING", createdAt: at(0) },
      { toStatus: "COMPLIANCE_REVIEW", createdAt: at(1) },
    ]);
    expect(timeline.map((step) => step.key)).toContain("compliance");
    expect(timeline.find((step) => step.key === "compliance")?.state).toBe("current");
  });

  it("marks the remaining steps as skipped when a transfer fails", () => {
    const timeline = buildTimeline("FAILED", [
      { toStatus: "PENDING", createdAt: at(0) },
      { toStatus: "PROCESSING", createdAt: at(1) },
      { toStatus: "FAILED", createdAt: at(2) },
    ]);
    expect(timeline.find((step) => step.key === "initiated")?.state).toBe("stopped");
    expect(timeline.find((step) => step.key === "paid")?.state).toBe("skipped");
  });

  it("timestamps each completed step from the real event log", () => {
    const timeline = buildTimeline("COMPLETED", [
      { toStatus: "PENDING", createdAt: at(0) },
      { toStatus: "PROCESSING", createdAt: at(1) },
      { toStatus: "PAYMENT_RECEIVED", createdAt: at(2) },
      { toStatus: "CONVERTING", createdAt: at(3) },
      { toStatus: "SENT", createdAt: at(4) },
      { toStatus: "COMPLETED", createdAt: at(5) },
    ]);
    expect(timeline.find((step) => step.key === "received")?.at).toEqual(at(2));
    // A completed transfer has no step still in progress — including the last.
    expect(timeline.every((step) => step.state === "done")).toBe(true);
  });
});
