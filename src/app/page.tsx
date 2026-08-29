"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import { site, telHref } from "@/lib/site";
import {
  Bot, Zap, Users, Globe, Megaphone, Mic, FileText,
  BarChart3, Kanban, Store, Star, Check, PhoneCall,
  ArrowRight, Sparkles, PhoneIncoming, ClipboardCheck, UserPlus, Mail,
} from "lucide-react";

/** What happens on a call, in the order it happens. */
const howItWorks = [
  {
    icon: PhoneIncoming,
    step: "Someone rings",
    desc: "Your AI answers on the first ring — evenings, weekends, while you're on a job.",
  },
  {
    icon: Mic,
    step: "It has a conversation",
    desc: "It asks what they need, answers questions about your business, and offers to book them in.",
  },
  {
    icon: ClipboardCheck,
    step: "You get the transcript",
    desc: "Every call is written up and summarised. Nothing depends on you remembering it.",
  },
  {
    icon: UserPlus,
    step: "The lead lands in your CRM",
    desc: "Their name, number and what they wanted — filed automatically, ready to follow up.",
  },
];

/** The rest of the platform, honestly framed as what surrounds the phone agent. */
const modules = [
  { icon: Users,     title: "CRM",                 desc: "Contacts, pipeline and deals. Callers land here on their own." },
  { icon: Bot,       title: "AI Agent Hub",        desc: "Specialist assistants for support, sales, finance and more." },
  { icon: Megaphone, title: "Marketing AI",        desc: "Write posts, emails and ad copy, then keep them as campaigns." },
  { icon: FileText,  title: "Document Intelligence", desc: "Upload a document and ask it questions. Save the analysis." },
  { icon: Zap,       title: "Automation",          desc: "Connect a trigger in one part of the business to an action in another." },
  { icon: BarChart3, title: "Analytics",           desc: "Revenue, pipeline and AI usage — all from your own records." },
  { icon: Kanban,    title: "Projects",            desc: "Boards and tasks to track the work the calls turn into." },
  { icon: Globe,     title: "Website Builder",     desc: "Track the sites and landing pages you run." },
  { icon: Store,     title: "Marketplace",         desc: "Install a ready-made agent built for your industry." },
];

const plans = PLANS.filter((p) => p.id !== "free");

export default function LandingPage() {
  const router = useRouter();

  /**
   * Checkout needs an account, so a visitor picking a plan is sent to sign-up
   * with the plan remembered; from there they land on Settings to complete it.
   */
  function choosePlan(planId: string) {
    if (planId === "enterprise" && site.contactEmail) {
      window.location.href = `mailto:${site.contactEmail}?subject=Enterprise%20enquiry`;
      return;
    }
    router.push(`/register?plan=${planId}`);
  }

  const demoHref = site.demoNumber ? telHref(site.demoNumber) : site.bookingUrl || null;

  return (
    <div className="min-h-screen bg-slam-dark text-slate-100 overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slam-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">SlamAI <span className="text-brand-400">AIOS</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#how"      className="hover:text-white transition-colors">How it works</a>
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"    className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-5">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-bg pt-32 pb-20 px-6 text-center relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-950/60 border border-brand-800 rounded-full px-4 py-1.5 text-sm text-brand-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            AI phone agents for Irish service businesses
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Stop losing jobs to<br /><span className="gradient-text">missed calls</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            An AI that answers your phone, talks to the customer properly, books them in, and
            writes the lead straight into your CRM. It works at 9pm on a Sunday.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {demoHref && (
              <a href={demoHref} className="btn-primary text-base py-3.5 px-8 flex items-center gap-2 justify-center">
                <PhoneCall className="w-4 h-4" />
                {site.demoNumber ? `Ring it: ${site.demoNumber}` : "Book a live demo"}
              </a>
            )}
            <Link
              href="/register"
              className={`${demoHref ? "btn-secondary" : "btn-primary"} text-base py-3.5 px-8 flex items-center gap-2 justify-center`}
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <p className="text-sm text-slate-500 mt-4">
            {site.demoNumber
              ? "That's a real number. Talk to the agent yourself before you decide anything."
              : "14-day free trial · No credit card required · Cancel anytime"}
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-6 border-y border-slam-border bg-slam-card/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">What happens when someone rings</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Four steps, no work from you after setup.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((s, i) => (
              <div key={s.step} className="glass rounded-xl p-6 relative">
                <div className="absolute top-6 right-6 text-3xl font-black text-slam-border select-none">
                  {i + 1}
                </div>
                <div className="w-11 h-11 rounded-xl bg-brand-600/20 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2">{s.step}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAMPLE CALL */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-6">It holds a<br /><span className="gradient-text">real conversation</span></h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-lg">
              You write the instructions in plain English — what you do, what you charge, what it
              should never promise. It sticks to them, asks one question at a time, and hands the
              call to you if the customer asks for a person.
            </p>
            <div className="space-y-4">
              {[
                "Answers every call, 24/7",
                "Transfers to your mobile on request",
                "Full transcript of every conversation",
                "Captures the caller as a CRM lead automatically",
                "You set the voice, the greeting and the rules",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-slate-300">{f}</span>
                </div>
              ))}
            </div>
            <Link href="/register" className="btn-primary mt-8 inline-flex items-center gap-2">
              Set yours up <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* An illustrative script, labelled as one — not presented as live data. */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slam-border">
              <PhoneIncoming className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium">Example call</span>
              <span className="text-xs text-slate-600 ml-auto">Illustration</span>
            </div>
            <div className="space-y-3">
              {[
                { who: "agent",  text: "Good evening, thanks for calling Murphy Plumbing. How can I help?" },
                { who: "caller", text: "Yeah, hi — I've a leak under the kitchen sink." },
                { who: "agent",  text: "Sorry to hear that. Is water still coming out, or have you managed to stop it?" },
                { who: "caller", text: "I turned it off at the mains." },
                { who: "agent",  text: "Good call, that buys us time. Can I take your name and the area you're in?" },
                { who: "caller", text: "Dave Kelly, out in Clondalkin." },
                { who: "agent",  text: "Thanks Dave. I can get someone to you tomorrow morning — does nine o'clock suit?" },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.who === "caller" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.who === "caller"
                      ? "bg-brand-600 text-white rounded-br-sm"
                      : "bg-slam-dark border border-slam-border text-slate-300 rounded-bl-sm"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slam-border flex items-center gap-2 text-sm">
              <UserPlus className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span className="text-slate-400">Dave Kelly saved to your CRM, tagged</span>
              <span className="text-cyan-400 text-xs bg-cyan-500/10 px-2 py-0.5 rounded-full">voice-ai</span>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="py-24 px-6 bg-slam-card/20 border-y border-slam-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">And the rest of the business,<br /><span className="gradient-text">in the same place</span></h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              The phone agent is the front door. Behind it is everything the call turns into.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((m) => (
              <div key={m.title} className="glass rounded-xl p-6 card-hover">
                <div className="w-11 h-11 rounded-xl bg-brand-600/20 flex items-center justify-center mb-4">
                  <m.icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2">{m.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-lg">Every plan starts with a 14-day free trial.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div key={p.id} className={`glass rounded-2xl p-6 border-2 relative ${p.popular ? "border-brand-500 scale-105 glow-purple" : "border-slate-700"}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                  <p className="text-xs text-slate-500 mb-3">{p.tagline}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">€{p.price.toLocaleString()}</span>
                    <span className="text-slate-500">/{p.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => choosePlan(p.id)}
                  className={`block w-full text-center py-2.5 rounded-lg font-semibold text-sm transition-all ${p.popular ? "btn-primary" : "btn-secondary"}`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto glass rounded-3xl p-12 glow-purple">
          <PhoneCall className="w-12 h-12 text-brand-400 mx-auto mb-6" />
          <h2 className="text-4xl font-black mb-4">How many calls did you miss this week?</h2>
          <p className="text-slate-400 text-lg mb-8">
            Every one of them was someone ready to buy. Set your AI up in an afternoon and stop
            finding out about them from a voicemail.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="btn-primary text-base py-4 px-10 inline-flex items-center gap-2 justify-center">
              Start free trial <ArrowRight className="w-5 h-5" />
            </Link>
            {site.contactEmail && (
              <a
                href={`mailto:${site.contactEmail}`}
                className="btn-secondary text-base py-4 px-10 inline-flex items-center gap-2 justify-center"
              >
                <Mail className="w-4 h-4" /> Talk to us first
              </a>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-4">14-day free trial · No credit card required</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slam-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold">SlamAI AIOS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            {site.demoNumber && (
              <a href={telHref(site.demoNumber)} className="hover:text-slate-300 transition-colors">
                {site.demoNumber}
              </a>
            )}
            {site.contactEmail && (
              <a href={`mailto:${site.contactEmail}`} className="hover:text-slate-300 transition-colors">
                {site.contactEmail}
              </a>
            )}
          </div>
          <p className="text-sm text-slate-600">© {new Date().getFullYear()} SlamAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
