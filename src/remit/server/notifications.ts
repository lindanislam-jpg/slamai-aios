import "server-only";
import { db } from "@/lib/db";
import { brand, wordmark } from "../config/brand";
import { getNotificationProvider } from "../providers/registry";
import { Money } from "../money/money";
import type { RemitTransfer } from "@prisma/client";

/**
 * Notification infrastructure.
 *
 * Every notification is persisted before it is handed to a provider, so the
 * record of what a customer was told survives a provider outage. Email is the
 * only channel wired up; SMS and push are additional `NotificationProvider`
 * implementations and a channel column that already exists.
 */

export type NotificationTemplate =
  | "transfer.created"
  | "transfer.payment_received"
  | "transfer.processing"
  | "transfer.compliance_review"
  | "transfer.sent"
  | "transfer.completed"
  | "transfer.failed"
  | "transfer.cancelled";

interface TemplateContext {
  customerName: string;
  transfer: RemitTransfer;
  recipientName: string;
}

function renderTemplate(
  template: NotificationTemplate,
  context: TemplateContext,
): { subject: string; body: string } {
  const { transfer, recipientName, customerName } = context;
  const sent = Money.fromMinor(transfer.sourceAmountMinor, transfer.sourceCurrency).format();
  const receives = Money.fromMinor(transfer.destAmountMinor, transfer.destCurrency).format();
  const ref = transfer.reference;
  const sandboxNote = transfer.isDemo
    ? "\n\nThis is a sandbox transfer. No real money has moved."
    : "";

  const templates: Record<NotificationTemplate, { subject: string; body: string }> = {
    "transfer.created": {
      subject: `Transfer ${ref} created`,
      body: `Hi ${customerName},\n\nWe've received your transfer of ${sent} to ${recipientName}. They'll receive ${receives}.\n\nWe'll let you know as soon as your payment clears.`,
    },
    "transfer.payment_received": {
      subject: `We've received your payment for ${ref}`,
      body: `Hi ${customerName},\n\nYour payment of ${sent} has cleared. We're now processing the transfer to ${recipientName}.`,
    },
    "transfer.processing": {
      subject: `Transfer ${ref} is processing`,
      body: `Hi ${customerName},\n\nWe're collecting your payment of ${sent} for the transfer to ${recipientName}.`,
    },
    "transfer.compliance_review": {
      subject: `Transfer ${ref} needs a quick check`,
      body: `Hi ${customerName},\n\nYour transfer of ${sent} to ${recipientName} is going through required verification checks. This is routine and we'll update you as soon as it's done. Your rate is unchanged.`,
    },
    "transfer.sent": {
      subject: `Transfer ${ref} is on its way`,
      body: `Hi ${customerName},\n\n${receives} is on its way to ${recipientName}. We'll confirm once it lands.`,
    },
    "transfer.completed": {
      subject: `${recipientName} has been paid`,
      body: `Hi ${customerName},\n\n${recipientName} has received ${receives}.\n\nReference: ${ref}\nYou sent: ${sent}\nThey received: ${receives}`,
    },
    "transfer.failed": {
      subject: `Transfer ${ref} could not be completed`,
      body: `Hi ${customerName},\n\nWe weren't able to complete your transfer of ${sent} to ${recipientName}.\n\nReason: ${transfer.failureReason ?? "Not specified"}\n\nAny funds collected will be returned. Contact ${brand.supportEmail} if you'd like help.`,
    },
    "transfer.cancelled": {
      subject: `Transfer ${ref} cancelled`,
      body: `Hi ${customerName},\n\nYour transfer of ${sent} to ${recipientName} has been cancelled. Any funds collected will be returned.`,
    },
  };

  const rendered = templates[template];
  return {
    subject: rendered.subject,
    body: `${rendered.body}${sandboxNote}\n\n— ${wordmark()}`,
  };
}

export async function notifyTransfer(
  template: NotificationTemplate,
  args: { customerId: string; transfer: RemitTransfer; recipientName: string },
): Promise<void> {
  const customer = await db.remitCustomer.findUnique({ where: { id: args.customerId } });
  if (!customer) return;

  const { subject, body } = renderTemplate(template, {
    customerName: customer.fullName.split(" ")[0] || "there",
    transfer: args.transfer,
    recipientName: args.recipientName,
  });

  const notification = await db.remitNotification.create({
    data: {
      customerId: customer.id,
      transferId: args.transfer.id,
      channel: "EMAIL",
      template,
      destination: customer.email,
      subject,
      body,
      status: "QUEUED",
    },
  });

  try {
    const provider = getNotificationProvider();
    const result = await provider.send({
      channel: "EMAIL",
      destination: customer.email,
      subject,
      body,
      template,
      metadata: { transferReference: args.transfer.reference },
    });

    await db.remitNotification.update({
      where: { id: notification.id },
      data: {
        status: result.delivered ? "SENT" : "FAILED",
        provider: provider.info.key,
        error: result.error ?? null,
        sentAt: result.delivered ? new Date() : null,
      },
    });
  } catch (error) {
    // A notification failure must never roll back a transfer that has already
    // moved money. It is recorded as FAILED and can be retried.
    await db.remitNotification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Send failed" },
    });
  }
}

/** Which status changes tell the customer something worth an email. */
export const STATUS_NOTIFICATIONS: Partial<Record<string, NotificationTemplate>> = {
  PROCESSING: "transfer.processing",
  PAYMENT_RECEIVED: "transfer.payment_received",
  COMPLIANCE_REVIEW: "transfer.compliance_review",
  SENT: "transfer.sent",
  COMPLETED: "transfer.completed",
  FAILED: "transfer.failed",
  CANCELLED: "transfer.cancelled",
};
