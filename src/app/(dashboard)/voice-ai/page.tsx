"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import PreviewNotice from "@/components/dashboard/PreviewNotice";
import { Mic, Phone, PhoneIncoming, Volume2, MessageSquare, Clock, TrendingUp, Calendar, CheckCircle, PlayCircle, PauseCircle } from "lucide-react";

export default function VoiceAIPage() {
  const [isActive, setIsActive] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header title="Voice AI" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <PreviewNotice feature="Voice AI" />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Calls Today",       value: "—", icon: Phone,       color: "text-blue-400",   bg: "bg-blue-500/10"   },
            { label: "Avg. Handle Time",  value: "—", icon: Clock,       color: "text-green-400",  bg: "bg-green-500/10"  },
            { label: "Appointments Set",  value: "—", icon: Calendar,    color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "Resolution Rate",   value: "—", icon: TrendingUp,  color: "text-yellow-400", bg: "bg-yellow-500/10" },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <div className="text-2xl font-bold text-slate-600">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent status */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-6">Voice Agent Status</h3>
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all ${isActive ? "border-green-500 shadow-lg shadow-green-500/30" : "border-slam-border"}`}>
                  {isActive && <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />}
                  <Mic className={`w-14 h-14 ${isActive ? "text-green-400" : "text-slate-600"}`} />
                </div>
                {isActive && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /></div>}
              </div>

              <div className="text-center">
                <div className={`text-lg font-bold ${isActive ? "text-green-400" : "text-slate-500"}`}>
                  {isActive ? "Agent Active — Listening" : "Agent Offline"}
                </div>
                <p className="text-sm text-slate-500 mt-1">{isActive ? "Ready to handle incoming calls 24/7" : "Activate to enable phone AI"}</p>
              </div>

              <button onClick={() => setIsActive(!isActive)} className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all ${isActive ? "bg-red-600/20 text-red-400 border border-red-600/40 hover:bg-red-600/30" : "bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30"}`}>
                {isActive ? <><PauseCircle className="w-5 h-5" />Deactivate Agent</> : <><PlayCircle className="w-5 h-5" />Activate Agent</>}
              </button>

              <div className="w-full space-y-3">
                {[
                  { label: "Answer calls",        enabled: true  },
                  { label: "Book appointments",   enabled: true  },
                  { label: "Qualify leads",       enabled: true  },
                  { label: "Transfer to human",   enabled: true  },
                  { label: "Send SMS follow-up",  enabled: false },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{f.label}</span>
                    <div className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${f.enabled ? "bg-brand-600" : "bg-slam-border"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${f.enabled ? "left-5" : "left-0.5"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Call script */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">AI Call Script</h3>
            <div className="space-y-3 text-sm">
              {[
                { step: "Greeting",      script: "Hello! Thank you for calling. I'm SlamAI, your virtual assistant. How can I help you today?",  icon: Volume2   },
                { step: "Qualification", script: "Great! Could I get your name and the best way to reach you? What brings you to us today?",        icon: MessageSquare },
                { step: "Booking",       script: "I'd love to arrange a call with our team. Are you available this week? I can check availability.", icon: Calendar  },
                { step: "Handoff",       script: "Let me connect you with one of our specialists who can help you further. Please hold briefly.",    icon: Phone     },
                { step: "Resolution",    script: "Is there anything else I can help you with today? Thank you for calling — have a great day!",     icon: CheckCircle },
              ].map(s => (
                <div key={s.step} className="flex gap-3 p-3 bg-slam-dark rounded-xl border border-slam-border">
                  <s.icon className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-xs text-brand-300 mb-1">{s.step}</div>
                    <p className="text-slate-400 leading-relaxed text-xs">{s.script}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call logs */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Recent Calls</h3>
          </div>
          <div className="bg-slam-dark rounded-xl border border-dashed border-slam-border py-10 text-center">
            <PhoneIncoming className="w-6 h-6 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No calls yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Call records will appear here once telephony is connected.
            </p>
          </div>
        </div>

        {/* Integrations */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: "Twilio",        desc: "Phone number provisioning & call routing", connected: true,  color: "from-red-500 to-rose-600"    },
            { name: "GoHighLevel",   desc: "CRM sync & appointment management",        connected: false, color: "from-orange-500 to-yellow-600" },
          ].map(i => (
            <div key={i.name} className="glass rounded-xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${i.color} flex items-center justify-center flex-shrink-0`}>
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-slate-500">{i.desc}</div>
              </div>
              <button className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${i.connected ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-brand-600/20 text-brand-400 border border-brand-600/30 hover:bg-brand-600/30"}`}>
                {i.connected ? "Connected" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
