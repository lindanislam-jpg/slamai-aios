"use client";

import Link from "next/link";
import {
  Bot, Zap, Users, Globe, Megaphone, Mic, FileText,
  BarChart3, Kanban, Store, ChevronRight, Star, Check,
  ArrowRight, Sparkles, Shield, TrendingUp, Clock
} from "lucide-react";

const modules = [
  { icon: Bot,       title: "AI Agent Hub",        desc: "Deploy specialized AI employees: sales, support, HR, finance, and more.",       color: "from-purple-500 to-indigo-600" },
  { icon: Users,     title: "CRM System",           desc: "Manage contacts, pipelines, and deals with AI-powered lead scoring.",            color: "from-blue-500 to-cyan-600" },
  { icon: Zap,       title: "Automation Center",    desc: "Connect Gmail, Slack, Shopify, Stripe and automate any business workflow.",      color: "from-yellow-500 to-orange-600" },
  { icon: Globe,     title: "Website Builder",      desc: "Create AI-powered websites, landing pages, and e-commerce stores in minutes.",   color: "from-green-500 to-emerald-600" },
  { icon: Megaphone, title: "Marketing AI",         desc: "Generate and schedule content for LinkedIn, Instagram, email, and more.",        color: "from-pink-500 to-rose-600" },
  { icon: Mic,       title: "Voice AI",             desc: "AI phone agents that answer calls, book appointments, and qualify leads 24/7.",   color: "from-cyan-500 to-blue-600" },
  { icon: FileText,  title: "Document Intelligence",desc: "Upload PDFs, Excel, CAD files — AI reads, summarizes, and answers questions.",   color: "from-violet-500 to-purple-600" },
  { icon: BarChart3, title: "Analytics Dashboard",  desc: "Real-time revenue, leads, AI usage, and team productivity in one view.",         color: "from-teal-500 to-green-600" },
  { icon: Kanban,    title: "Project Management",   desc: "Kanban boards, tasks, team collaboration with AI meeting summaries.",            color: "from-orange-500 to-red-600" },
  { icon: Store,     title: "AI Marketplace",       desc: "Install industry-specific agents: logistics, real estate, insurance, and more.", color: "from-indigo-500 to-blue-600" },
];

const plans = [
  {
    name: "Starter",    price: 49,  period: "month",
    features: ["1 user", "1 AI assistant", "Basic automation", "5 GB storage", "Email support"],
    color: "border-slate-700", cta: "Start Free Trial", popular: false,
  },
  {
    name: "Professional", price: 149, period: "month",
    features: ["5 users", "All AI agents", "CRM system", "Marketing AI", "Analytics", "Website builder", "Priority support"],
    color: "border-brand-500", cta: "Get Started", popular: true,
  },
  {
    name: "Business",   price: 499, period: "month",
    features: ["Unlimited users", "Voice AI", "Advanced automations", "Custom branding", "API access", "Dedicated manager"],
    color: "border-slate-700", cta: "Get Started", popular: false,
  },
  {
    name: "Enterprise", price: 1999, period: "month",
    features: ["Everything in Business", "White-label platform", "Custom AI agents", "SLA guarantee", "Onboarding & training"],
    color: "border-yellow-500", cta: "Contact Sales", popular: false,
  },
];

const stats = [
  { label: "AI Agents Deployed", value: "10,000+", icon: Bot },
  { label: "Hours Automated Weekly", value: "500K+",  icon: Clock },
  { label: "Businesses Powered",   value: "2,500+",  icon: TrendingUp },
  { label: "Uptime Guarantee",     value: "99.9%",   icon: Shield },
];

export default function LandingPage() {
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
            <a href="#modules"  className="hover:text-white transition-colors">Modules</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"    className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-5">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-bg pt-32 pb-24 px-6 text-center relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand-950/60 border border-brand-800 rounded-full px-4 py-1.5 text-sm text-brand-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Introducing SlamAI AIOS™ — One Platform. Infinite Intelligence.
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            The <span className="gradient-text">AI Operating System</span><br />for Modern Business
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Replace repetitive work with AI digital employees. Deploy agents, automate workflows, manage customers, create content, and grow your business — all from one intelligent platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-base py-3.5 px-8 flex items-center gap-2 justify-center">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-secondary text-base py-3.5 px-8 flex items-center gap-2 justify-center">
              View Demo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-4">No credit card required · 14-day free trial · Cancel anytime</p>
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 border-y border-slam-border bg-slam-card/30">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="w-6 h-6 text-brand-400 mx-auto mb-2" />
              <div className="text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">10 Powerful Modules.<br /><span className="gradient-text">One Unified Platform.</span></h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Everything your business needs to automate, grow, and scale — powered by the world&apos;s most advanced AI models.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {modules.map((m) => (
              <div key={m.title} className="glass rounded-xl p-6 card-hover cursor-pointer group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <m.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2">{m.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES HIGHLIGHT */}
      <section id="features" className="py-24 px-6 bg-slam-card/20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-6">Your AI Team.<br /><span className="gradient-text">Working 24/7.</span></h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-lg">
              SlamAI AIOS gives your business a full team of AI employees — each specialized for a different function. They learn your business, follow your workflows, and never take a day off.
            </p>
            <div className="space-y-4">
              {["Multi-language support for global teams", "Long-term memory across sessions", "Voice conversations on any device", "Seamless integrations with 50+ tools", "White-label ready for agencies"].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-slate-300">{f}</span>
                </div>
              ))}
            </div>
            <Link href="/register" className="btn-primary mt-8 inline-flex items-center gap-2">
              Deploy Your AI Team <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="glass rounded-2xl p-6 space-y-4">
            {[
              { agent: "Customer Support Agent", status: "Active", msg: "Resolved 47 tickets today", color: "bg-green-500" },
              { agent: "Sales Agent",            status: "Active", msg: "Qualified 12 new leads",    color: "bg-blue-500"  },
              { agent: "Marketing Agent",        status: "Active", msg: "Published 3 campaigns",     color: "bg-purple-500"},
              { agent: "Finance Agent",          status: "Active", msg: "Generated 8 invoices",      color: "bg-yellow-500"},
            ].map((a) => (
              <div key={a.agent} className="flex items-center gap-4 p-4 bg-slam-dark/50 rounded-xl border border-slam-border">
                <div className={`w-2.5 h-2.5 rounded-full ${a.color} animate-pulse`} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.agent}</div>
                  <div className="text-xs text-slate-500">{a.msg}</div>
                </div>
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{a.status}</span>
              </div>
            ))}
            <div className="text-center pt-2 text-sm text-slate-500">Live AI team dashboard · Updates every 30s</div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-lg">Scale as you grow. Start free, upgrade anytime.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div key={p.name} className={`glass rounded-2xl p-6 border-2 ${p.color} relative ${p.popular ? "scale-105 glow-purple" : ""}`}>
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-1">{p.name}</h3>
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
                <Link
                  href="/register"
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-all ${p.popular ? "btn-primary" : "btn-secondary"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto glass rounded-3xl p-12 glow-purple">
          <Sparkles className="w-12 h-12 text-brand-400 mx-auto mb-6" />
          <h2 className="text-4xl font-black mb-4">Ready to Run Your Business on AI?</h2>
          <p className="text-slate-400 text-lg mb-8">Join thousands of businesses already using SlamAI AIOS to work smarter, faster, and more profitably.</p>
          <Link href="/register" className="btn-primary text-base py-4 px-10 inline-flex items-center gap-2">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
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
            <span className="font-bold">SlamAI AIOS™</span>
          </div>
          <p className="text-sm text-slate-600">The Operating System for Modern Business</p>
          <p className="text-sm text-slate-600">© {new Date().getFullYear()} SlamAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
