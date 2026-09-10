import Link from "next/link";
import {
  ArrowRight, BarChart3, Bot, Calendar, Check, Clock, Headphones, Lock,
  PhoneCall, PhoneMissed, ShieldCheck, Sparkles, Users, Zap,
} from "lucide-react";
import MarketingNav from "@/components/voice/MarketingNav";
import MarketingFooter from "@/components/voice/MarketingFooter";
import VoiceWave from "@/components/voice/VoiceWave";
import DemoConversation from "@/components/voice/DemoConversation";
import { INDUSTRIES } from "@/lib/voice/industries";
import { PURCHASABLE_PLANS } from "@/lib/voice/plans";

const FEATURES = [
  {
    icon: PhoneCall,
    title: "Answers on the first ring",
    body: "Every call, every time — including the 6pm Friday one your team will never get to.",
  },
  {
    icon: Users,
    title: "Captures the lead",
    body: "Takes the name, the number and what they need, then scores it 0–100 so you know who to ring back first.",
  },
  {
    icon: Calendar,
    title: "Books the job",
    body: "Offers real times from your calendar and books them. It can't double-book, because it checks first.",
  },
  {
    icon: Headphones,
    title: "Puts people through",
    body: "Angry customer? Emergency? Big job? It hands the call to a person on your rules, not its own.",
  },
  {
    icon: Bot,
    title: "Knows your business",
    body: "Reads your website, your price list and your FAQs, and answers from those. It never makes anything up.",
  },
  {
    icon: BarChart3,
    title: "Shows you everything",
    body: "Full transcript, a plain-English summary and the outcome of every single call.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Tell it about your business",
    body: "Paste your website address. It reads your pages, your services and your prices in about ten seconds.",
  },
  {
    number: "02",
    title: "Connect your number",
    body: "Get a new number in seconds, or forward the number you already advertise. Either takes two minutes.",
  },
  {
    number: "03",
    title: "Hear it before your customers do",
    body: "Test it in your dashboard. Ask it a price it doesn't know and watch it offer a callback instead of guessing.",
  },
  {
    number: "04",
    title: "Switch it on",
    body: "From that moment nobody who rings you gets an unanswered phone again.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We were losing two or three jobs a week to voicemail. It books them in now while I'm under a sink. It paid for itself in the first fortnight.",
    name: "Declan M.",
    role: "Plumbing & heating, Dublin",
  },
  {
    quote:
      "The transcripts are the part I didn't expect. I can see exactly what every caller wanted, and what my AI told them.",
    name: "Aoife K.",
    role: "Dental practice manager, Cork",
  },
  {
    quote:
      "Out-of-hours enquiries used to go nowhere. Now they're leads on my desk on Monday morning, already scored.",
    name: "Tom B.",
    role: "Estate agency, Galway",
  },
];

const FAQS = [
  {
    q: "Does it sound like a robot?",
    a: "No — it uses a natural neural voice and speaks in short, plain sentences the way a good receptionist does. But it will always tell a caller it is an AI assistant if they ask. It never pretends to be a person.",
  },
  {
    q: "Will it make up prices?",
    a: "It can't. It only quotes prices from the service list you set up. For anything you price on site, it says a colleague will confirm the cost and takes the caller's details.",
  },
  {
    q: "Do I have to change my phone number?",
    a: "No. Keep advertising the number you have and forward it to SlamAI — that takes two minutes with any carrier. Or get a new number from us in seconds.",
  },
  {
    q: "What happens if it can't help?",
    a: "It transfers the caller to whoever you nominate, on the rules you set: they ask for a person, they're upset, it's an emergency, it's a big job, or it simply doesn't know. If nobody picks up, it takes a message and files the lead.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses are live in under ten minutes. Paste your website, connect a number, test it, switch it on.",
  },
  {
    q: "What about my customers' data?",
    a: "Every business's data is completely separate. Calls, transcripts and leads belong to your workspace and nobody else can reach them. You choose how long call history is kept, and you can delete it.",
  },
];

export default function VoiceLandingPage() {
  return (
    <>
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -15%, rgba(99,102,241,0.26), transparent), radial-gradient(ellipse 45% 40% at 85% 60%, rgba(6,182,212,0.12), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:pt-24 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-[12.5px] font-medium text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" />
                Live in under ten minutes
              </span>

              <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-tight text-white sm:text-[56px]">
                Your AI Receptionist.
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  24/7. Never Miss a Customer.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-400">
                SlamAI Voice answers your calls, talks to customers, captures leads, books appointments and keeps your
                business running around the clock.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/voice/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-6 py-3.5 text-[15px] font-medium text-white shadow-xl shadow-indigo-900/50 transition-all hover:from-indigo-400 hover:to-violet-500"
                >
                  Start Free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/voice/demo"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[15px] font-medium text-slate-200 transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Watch Demo
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-slate-500">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No card required</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Keep your number</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Cancel any time</span>
              </div>
            </div>

            <div className="relative">
              <VoiceWave />
              <DemoConversation />
            </div>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <ProblemStat
              icon={<PhoneMissed className="h-5 w-5" />}
              stat="1 in 4"
              label="business calls go unanswered"
              body="Every one of them is a customer who rings the next name on the list."
            />
            <ProblemStat
              icon={<Clock className="h-5 w-5" />}
              stat="After 6pm"
              label="is when your competitors sleep"
              body="Emergency and evening callers are the ones most ready to book."
            />
            <ProblemStat
              icon={<Zap className="h-5 w-5" />}
              stat="Under 10 min"
              label="from signing up to answering"
              body="Not a project. Paste your website, connect a number, go."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps, one afternoon at most"
          body="No integration project, no phone system to replace, nobody to train."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.number} className="relative rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-6">
              <span className="text-[13px] font-semibold text-indigo-400">{step.number}</span>
              <h3 className="mt-3 text-[16px] font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <SectionHeading
            eyebrow="What it does"
            title="Answer every customer. Capture every opportunity."
            body="Not a voicemail with a nicer voice. It handles the call end to end and files the result where you can act on it."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-6 transition-all hover:border-indigo-500/30 hover:shadow-[0_20px_60px_-30px_rgba(99,102,241,0.6)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-violet-500/5 text-indigo-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <SectionHeading
          eyebrow="Who it's for"
          title="Built for businesses whose phone is their front door"
          body="Pick your trade at signup and your AI starts with the right instructions, the right services and the right urgency words."
        />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {INDUSTRIES.filter((i) => i.key !== "other").map((industry) => (
            <div
              key={industry.key}
              className="rounded-xl border border-white/[0.07] bg-[#111124]/60 px-4 py-5 text-center transition-colors hover:border-indigo-500/30"
            >
              <div className="text-2xl">{industry.icon}</div>
              <div className="mt-2 text-[13px] font-medium text-slate-300">{industry.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="One missed job costs more than a month of this"
            body="Every plan includes a free trial. No card to start."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-4">
            {PURCHASABLE_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-[#111124]/60 p-6 ${
                  plan.popular
                    ? "border-indigo-500/40 shadow-[0_0_60px_-25px_rgba(99,102,241,0.9)]"
                    : "border-white/[0.07]"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1 text-[11px] font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-[17px] font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{plan.tagline}</p>
                <div className="mt-4">
                  {plan.id === "enterprise" ? (
                    <span className="text-[32px] font-semibold leading-none text-white">Custom</span>
                  ) : (
                    <>
                      <span className="text-[32px] font-semibold leading-none text-white">€{plan.price}</span>
                      <span className="text-[14px] text-slate-500">/month</span>
                    </>
                  )}
                </div>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 text-[13.5px] text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.id === "enterprise" ? "/voice/demo" : "/voice/signup"}
                  className={`mt-6 rounded-xl px-4 py-2.5 text-center text-[14px] font-medium transition-all ${
                    plan.popular
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400"
                      : "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-[13px] text-slate-500">
            All prices exclude VAT. Each plan includes a monthly allowance of voice minutes; minutes beyond it are
            billed at the plan&apos;s overage rate.{" "}
            <Link href="/voice/pricing" className="text-indigo-400 hover:underline">
              Compare plans in full
            </Link>
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <SectionHeading eyebrow="What owners say" title="Turn missed calls into booked customers" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.name} className="rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-6">
              <blockquote className="text-[15px] leading-relaxed text-slate-300">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="text-[14px] font-medium text-white">{testimonial.name}</div>
                <div className="text-[13px] text-slate-500">{testimonial.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <TrustItem
              icon={<ShieldCheck className="h-5 w-5" />}
              title="It never invents anything"
              body="Prices, policies and availability come from what you set up. If it doesn't know, it says so and takes a message."
            />
            <TrustItem
              icon={<Lock className="h-5 w-5" />}
              title="Your data is yours alone"
              body="Every business is fully isolated. Nobody else can see your calls, transcripts or customers."
            />
            <TrustItem
              icon={<Bot className="h-5 w-5" />}
              title="It's honest about being AI"
              body="Ask it if it's a person and it will tell you plainly that it's an AI assistant. It never claims otherwise."
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
        <SectionHeading eyebrow="Questions" title="The things owners ask us first" />
        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group rounded-2xl border border-white/[0.07] bg-[#111124]/60 p-5">
              <summary className="cursor-pointer list-none text-[15px] font-medium text-white marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {faq.q}
                  <span className="shrink-0 text-slate-500 transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(99,102,241,0.22), transparent)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center lg:px-8">
          <h2 className="text-[36px] font-semibold leading-tight tracking-tight text-white sm:text-[44px]">
            Turn Every Call Into an Opportunity.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-slate-400">
            Your AI receptionist works while your team sleeps. Set it up in ten minutes and never lose another
            customer to a ringing phone.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/voice/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-7 py-3.5 text-[15px] font-medium text-white shadow-xl shadow-indigo-900/50 transition-all hover:from-indigo-400"
            >
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/voice/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-7 py-3.5 text-[15px] font-medium text-slate-200 transition-all hover:bg-white/[0.08]"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-indigo-400">{eyebrow}</span>
      <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight text-white sm:text-[36px]">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-slate-400">{body}</p>}
    </div>
  );
}

function ProblemStat({
  icon, stat, label, body,
}: {
  icon: React.ReactNode; stat: string; label: string; body: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-300">
        {icon}
      </div>
      <div>
        <div className="text-[22px] font-semibold leading-tight text-white">{stat}</div>
        <div className="text-[14px] font-medium text-slate-300">{label}</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-300">
        {icon}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-white">{title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">{body}</p>
      </div>
    </div>
  );
}
