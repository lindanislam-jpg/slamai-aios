import Link from "next/link";
import type { Metadata } from "next";
import { brand, wordmark } from "@/remit/config/brand";
import { requireCustomer } from "@/remit/server/auth";
import { Card, PageHeader } from "@/components/remit/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Help & support" };

const FAQS = [
  {
    q: "What does a transfer cost?",
    a: "A flat transfer fee, shown before you confirm, plus whatever exchange rate is displayed on your quote. There is no second fee later and nothing is deducted from the amount your recipient receives.",
  },
  {
    q: "Do you add a margin to the exchange rate?",
    a: "We show the market rate and our margin as separate lines on every quote. On Ireland → South Africa our margin is currently zero, so you get the rate we get.",
  },
  {
    q: "What happens if my quote expires?",
    a: "You get a new one. We never silently reprice a transfer you already saw — if the rate has moved, we show you the new number and ask again.",
  },
  {
    q: "Why was my transfer held for review?",
    a: "Some transfers go through additional verification checks — larger amounts, a new account, or a first transfer to a new recipient. Your rate is unchanged while it is reviewed and we email you as soon as it clears.",
  },
  {
    q: "Can I cancel a transfer?",
    a: "Yes, until we have collected your payment. After that the money is already in motion and cancelling is no longer possible — contact support instead.",
  },
  {
    q: "Who actually moves the money?",
    a: "Regulated payment and payout partners. This application is the customer-facing platform; it never holds or transmits your funds itself.",
  },
];

export default async function SendHelpPage() {
  await requireCustomer();

  return (
    <div className="space-y-6">
      <PageHeader title="Help & support" description="Answers to what people ask most." />

      <Card>
        <h2 className="text-[15px] font-bold text-send-ink">Contact us</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-send-body">
          Email{" "}
          <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-send-primary">
            {brand.supportEmail}
          </a>{" "}
          with your transfer reference and we will come back to you.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-send-muted">
          Not happy with something? Our{" "}
          <Link href="/send/legal/complaints" className="font-semibold text-send-primary underline">
            complaints procedure
          </Link>{" "}
          sets out how we handle it and what to do if you are still unhappy.
        </p>
      </Card>

      <div className="space-y-2">
        {FAQS.map((faq) => (
          <details key={faq.q} className="send-card group p-0">
            <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-bold text-send-ink">
              {faq.q}
            </summary>
            <p className="px-5 pb-4 text-[14px] leading-relaxed text-send-body">{faq.a}</p>
          </details>
        ))}
      </div>

      <Card className="bg-send-accent-soft">
        <h2 className="text-[15px] font-bold text-send-warning">This is a sandbox build</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-send-warning">
          {wordmark()} is not connected to a regulated payment institution and holds no licence or
          registration. Nothing here can move real money, and every rate shown is an indicative
          sandbox value rather than a market rate.
        </p>
      </Card>
    </div>
  );
}
