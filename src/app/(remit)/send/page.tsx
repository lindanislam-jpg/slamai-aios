import Link from "next/link";
import { db } from "@/lib/db";
import { brand, wordmark } from "@/remit/config/brand";
import { serializeCorridor } from "@/remit/server/serialize";
import { RateCalculator, type CorridorOption } from "@/components/remit/RateCalculator";
import { Footer, LinkButton, SandboxBadge, Wordmark } from "@/components/remit/ui";
import { redirect } from "next/navigation";
import { blockingProblems } from "@/remit/config/preflight";
import { runPreflight } from "@/remit/server/preflight-service";

export const dynamic = "force-dynamic";

/**
 * Landing page.
 *
 * Every claim on this page is one the product can actually stand behind. There
 * is no "100% secure", no "instant worldwide transfers" and no invented
 * regulatory status — the sandbox state is stated plainly instead.
 */
export default async function SendLandingPage() {
  // An unconfigured deployment used to 500 here with no explanation. Fail into
  // a page that names the missing piece instead.
  let options: CorridorOption[];
  try {
    const corridors = await db.remitCorridor.findMany({
      where: { isActive: true },
      include: { sourceCountry: true, destCountry: true, paymentOptions: true, payoutOptions: true },
      orderBy: { createdAt: "asc" },
    });
    if (corridors.length === 0) throw new Error("No active corridors");
    options = corridors.map(serializeCorridor);
  } catch {
    // Unconfigured or unseeded: send the operator to the page that names the
    // missing piece instead of returning a 500 with no explanation.
    const report = await runPreflight();
    if (!report.ok || blockingProblems(report.checks).length > 0) redirect("/send/setup");
    throw new Error("Corridors are configured but could not be loaded");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-send-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Wordmark />
          <nav className="flex items-center gap-2">
            <Link
              href="/send/login"
              className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-send-body hover:text-send-primary"
            >
              Sign in
            </Link>
            <LinkButton href="/send/register">Get started</LinkButton>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* --- Hero ------------------------------------------------------- */}
        <section className="send-hero">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.05fr_minmax(0,420px)] lg:py-20">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-send-primary/20 bg-white px-3 py-1.5 text-[12px] font-bold text-send-primary">
                🇮🇪 Ireland → 🇿🇦 South Africa
                <span className="text-send-muted">· first route</span>
              </span>

              <h1 className="mt-5 text-[38px] font-black leading-[1.05] tracking-tight text-send-ink sm:text-[52px]">
                Send money worldwide for a flat{" "}
                <span className="text-send-primary">€5</span> transfer fee.
              </h1>

              <p className="mt-4 text-[17px] leading-relaxed text-send-body">
                {brand.tagline} You see the fee, the exchange rate and the exact amount your
                recipient gets — before you pay a cent.
              </p>

              <dl className="mt-8 grid grid-cols-3 gap-3">
                {[
                  ["€5", "Flat fee, any amount"],
                  ["0%", "Added to the exchange rate"],
                  ["Same day", "Typical delivery"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-white px-4 py-3.5 shadow-sm">
                    <dt className="tnum text-[22px] font-black text-send-primary">{value}</dt>
                    <dd className="mt-0.5 text-[12px] leading-snug text-send-muted">{label}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/send/register" size="lg">
                  Send money
                </LinkButton>
                <LinkButton href="/send/login" variant="secondary" size="lg">
                  Try the demo
                </LinkButton>
              </div>
            </div>

            <div className="lg:pt-4">
              <RateCalculator corridors={options} />
            </div>
          </div>
        </section>

        {/* --- How it works ----------------------------------------------- */}
        <section className="border-y border-send-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-center text-[26px] font-bold tracking-tight text-send-ink sm:text-[32px]">
              Four steps. No surprises.
            </h2>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "You",
                  title: "Enter the amount",
                  body: "Pick the amount you want to send. We price it instantly and lock the rate.",
                  icon: "👤",
                },
                {
                  step: "Pay",
                  title: "Pay by bank transfer",
                  body: "You pay the amount plus the €5 fee. A regulated payment provider collects it.",
                  icon: "🏦",
                },
                {
                  step: "Convert",
                  title: "We convert at your locked rate",
                  body: "The rate you agreed is the rate that settles, whatever the market does after.",
                  icon: "🔄",
                },
                {
                  step: "Recipient",
                  title: "They get paid",
                  body: "The payout partner deposits the exact amount we showed you into their account.",
                  icon: "🎉",
                },
              ].map((item, index) => (
                <li key={item.step} className="send-card relative p-5">
                  <span
                    aria-hidden
                    className="grid h-11 w-11 place-items-center rounded-xl bg-send-primary-soft text-[20px]"
                  >
                    {item.icon}
                  </span>
                  <div className="mt-3 text-[11px] font-black uppercase tracking-wider text-send-primary">
                    {index + 1}. {item.step}
                  </div>
                  <h3 className="mt-1 text-[16px] font-bold text-send-ink">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-send-body">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --- Pricing honesty -------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-[26px] font-bold tracking-tight text-send-ink sm:text-[32px]">
                One fee. Shown before you pay.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-send-body">
                Most transfer services advertise a low fee and take the rest inside the exchange
                rate. We show you the rate we get and the margin we add — currently zero on this
                route — as separate lines, so you can check our arithmetic.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  ["Flat €5 transfer fee", "It does not scale with the amount you send."],
                  ["The rate we get", "We show the market rate and our margin separately."],
                  ["The exact recipient amount", "Calculated and locked before you confirm."],
                  ["A quote that expires honestly", "If the rate moves, we ask you again. We never change your amount quietly."],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-send-primary text-[11px] font-bold text-white"
                    >
                      ✓
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-send-ink">{title}</div>
                      <div className="text-[13px] leading-relaxed text-send-body">{body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="send-card bg-send-ink p-6 text-white">
              <div className="text-[12px] font-bold uppercase tracking-wide text-white/60">
                Example transfer
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["You send", "€300.00"],
                  ["Transfer fee", "€5.00"],
                  ["Total you pay", "€305.00"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[15px]">
                    <span className="text-white/70">{label}</span>
                    <span className="tnum font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-white/10 px-4 py-3.5">
                <div className="text-[12px] text-white/60">Your recipient gets</div>
                <div className="tnum mt-0.5 text-[26px] font-black">
                  the exact amount we quote
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-white/60">
                  Calculated live at the rate in your quote. Use the calculator above for the
                  current figure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- Trust ------------------------------------------------------- */}
        <section className="border-t border-send-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-[26px] font-bold tracking-tight text-send-ink sm:text-[32px]">
              How we handle your money and your data
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Regulated providers move the money",
                  body: "We are the app. Licensed payment and payout partners hold and transmit the funds. We never hold your money ourselves.",
                },
                {
                  title: "Transparent pricing",
                  body: "Fee, market rate, our margin and the recipient amount are all shown separately before you confirm.",
                },
                {
                  title: "Tracked end to end",
                  body: "Every transfer has a reference and a timeline, updated from the providers themselves rather than a guess.",
                },
                {
                  title: "Verified customers",
                  body: "Identity verification and sanctions screening run before a transfer is sent, as the rules require.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-send-line p-5">
                  <h3 className="text-[15px] font-bold text-send-ink">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-send-body">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-send-accent/40 bg-send-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <SandboxBadge />
                <p className="max-w-2xl text-[13px] leading-relaxed text-send-warning">
                  <strong>This is a sandbox build.</strong> {wordmark()} is not connected to a
                  regulated payment institution, holds no licence or registration, and cannot move
                  real money. Rates shown are indicative sandbox values. The demo account exists so
                  you can walk the complete journey safely.
                </p>
              </div>
              <LinkButton href="/send/login" variant="secondary" className="shrink-0">
                Open the demo
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
