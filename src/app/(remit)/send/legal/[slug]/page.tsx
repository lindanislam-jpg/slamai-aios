import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brand, wordmark } from "@/remit/config/brand";
import { Alert, Footer, Wordmark } from "@/components/remit/ui";

/**
 * Legal and regulatory pages.
 *
 * These are honest placeholders. They describe what each document must cover
 * and say plainly that it has not been drafted or reviewed yet. No licence,
 * registration, regulator or partnership is named anywhere — inventing one
 * would be a false statement about regulatory status, which is exactly the
 * thing a remittance business must never do.
 */

interface LegalPage {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

const PAGES: Record<string, LegalPage> = {
  terms: {
    title: "Terms & Conditions",
    intro:
      "The agreement between you and the operator of this service, covering what we do, what you agree to, and what happens when something goes wrong.",
    sections: [
      {
        heading: "What this document must cover",
        body: "Who the contracting entity is; the service provided; your obligations as a customer; our obligations; fees and how they are charged; exchange rates and how they are set; cancellation and refund rights; limits on liability; how the agreement can be changed or ended; and the governing law and courts.",
      },
      {
        heading: "Status",
        body: "Not yet drafted. This must be written and reviewed by a qualified lawyer in the relevant jurisdiction before this service takes a single real customer.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro:
      "How personal data is collected, used, shared and retained, and the rights you have over it.",
    sections: [
      {
        heading: "What this document must cover",
        body: "The identity of the data controller; what data is collected and why; the lawful basis for each purpose under the GDPR; who data is shared with (payment, payout, verification and screening providers); international transfers and their safeguards; retention periods, including the statutory retention that anti-money-laundering rules require; your rights of access, rectification, erasure, restriction, portability and objection; and how to complain to a supervisory authority.",
      },
      {
        heading: "Status",
        body: "Not yet drafted. A GDPR-compliant policy and a record of processing activities must exist before any real customer data is collected.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: "What is stored on your device, why, and how to control it.",
    sections: [
      {
        heading: "What this build actually uses",
        body: "A session cookie that keeps you signed in. No advertising, analytics or third-party tracking cookies are set by this application.",
      },
      {
        heading: "Status",
        body: "A full policy and consent mechanism must be in place before any non-essential cookie is introduced.",
      },
    ],
  },
  fees: {
    title: "Fees",
    intro: "Everything we charge, in one place.",
    sections: [
      {
        heading: "Transfer fee",
        body: "A flat fee per transfer, shown on your quote before you confirm and charged on top of the amount you send. It does not scale with the amount. The current fee is always the figure displayed on the quote screen.",
      },
      {
        heading: "Exchange rate and FX margin",
        body: "Every quote shows the market rate we were given, the margin we add, and the resulting rate applied to your money. On Ireland → South Africa our margin is currently zero. Where a margin applies, it is stated as a percentage on the quote rather than folded silently into the rate.",
      },
      {
        heading: "What we never charge",
        body: "There is no receiving fee taken from your recipient by us, no fee for saving a recipient, and no charge for cancelling a transfer before the funds are collected. Your own bank or your recipient's bank may apply their own charges, which are outside our control and are not paid to us.",
      },
    ],
  },
  complaints: {
    title: "Complaints",
    intro: "How to raise a problem and what happens next.",
    sections: [
      {
        heading: "How to complain",
        body: `Email ${brand.supportEmail} with your transfer reference and what went wrong. You will get an acknowledgement, a named point of contact, and a written outcome.`,
      },
      {
        heading: "What this procedure must cover before launch",
        body: "Acknowledgement and resolution timescales; escalation to a senior reviewer; a complaints register; and details of the independent ombudsman or dispute-resolution scheme you may refer the matter to if you remain unhappy. That scheme depends on the regulated entity that ultimately provides the service, so it cannot be named here yet.",
      },
    ],
  },
  regulatory: {
    title: "Regulatory information",
    intro: "The regulatory status of this service, stated plainly.",
    sections: [
      {
        heading: "Current status",
        body: `${wordmark()} is a customer-facing application in a sandbox environment. It is not authorised, licensed or registered as a payment institution, e-money institution or money transmitter in any jurisdiction. It holds no customer funds, moves no money, and is not currently connected to any regulated payment or payout provider.`,
      },
      {
        heading: "How the live service is intended to work",
        body: "The movement of funds would be carried out by regulated third parties: a licensed payment institution to collect funds from the customer, and a licensed remittance or payout partner to pay the recipient. This application would provide the customer experience, pricing display, record-keeping and compliance workflow around that. It would still require its own authorisation or a formal agent arrangement with an authorised firm before operating.",
      },
      {
        heading: "What we do not claim",
        body: "No licence number, no regulator, no scheme membership and no partner firm is named anywhere in this application, because none exists yet. Any such claim would be false.",
      },
    ],
  },
  verification: {
    title: "Verification & KYC",
    intro: "Why we verify customers and what it involves.",
    sections: [
      {
        heading: "Why it is required",
        body: "Businesses that send money across borders are legally required to establish who their customers are, screen them against sanctions lists, and monitor transactions for signs of money laundering or fraud. These are legal obligations, not optional features, and there is no way to opt out of them.",
      },
      {
        heading: "What we ask for",
        body: "Your full legal name, date of birth, address, and a photo identity document with a selfie. Documents go directly to the verification provider; this application stores only the outcome and a reference, never your ID images.",
      },
      {
        heading: "When a transfer is held",
        body: "Some transfers pause for a human check — larger amounts, a new account, unusual activity, or a possible screening match. Your rate is unchanged while it is reviewed and you are emailed as soon as it clears. Where a transfer cannot proceed, any funds collected are returned.",
      },
      {
        heading: "Record keeping",
        body: "Verification records, transfer records and the audit trail are retained for the period the applicable anti-money-laundering rules require, even after an account closes. Audit records are append-only and are never edited or deleted.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: PAGES[slug]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  const drafted = slug === "fees" || slug === "regulatory" || slug === "verification";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-send-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-3.5">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href="/send"
          className="text-[13px] font-semibold text-send-body hover:text-send-primary"
        >
          ← Back
        </Link>

        <h1 className="mt-4 text-[30px] font-black tracking-tight text-send-ink">{page.title}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-send-body">{page.intro}</p>

        {!drafted && (
          <div className="mt-6">
            <Alert tone="warning" title="Placeholder — not a legal document">
              This page describes what the document must contain. It has not been drafted or
              reviewed by a lawyer and must not be relied on.
            </Alert>
          </div>
        )}

        <div className="mt-8 space-y-7">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[17px] font-bold text-send-ink">{section.heading}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-send-body">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-send-line pt-6 text-[13px] leading-relaxed text-send-muted">
          Operated by {brand.legalEntity}. Questions about this page can go to{" "}
          <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-send-primary">
            {brand.supportEmail}
          </a>
          .
        </p>
      </main>

      <Footer />
    </div>
  );
}
