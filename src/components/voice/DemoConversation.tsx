"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, PhoneCall, User } from "lucide-react";

/**
 * The scripted conversation on the landing page. It mirrors how the real agent
 * behaves on an emergency call: establish urgency, take the address, confirm.
 */
const SCRIPT: { role: "caller" | "agent"; text: string }[] = [
  { role: "caller", text: "Hi, my boiler isn't working." },
  {
    role: "agent",
    text: "Hi! I'm the AI receptionist for ABC Plumbing. I'm sorry you're having trouble — I can help get this sorted. Is this an emergency, and are you currently without heating?",
  },
  { role: "caller", text: "Yes, there's no heat at all and I've a small baby in the house." },
  {
    role: "agent",
    text: "Understood, I'll treat this as urgent. Can I take your name and address so we can get someone out to you?",
  },
  { role: "caller", text: "Sarah Byrne, 14 Ashfield Road, Dublin 6." },
  {
    role: "agent",
    text: "Thanks Sarah. I have an engineer free at 4:30 this afternoon. Shall I book that in for you?",
  },
];

export default function DemoConversation() {
  const [visible, setVisible] = useState(1);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Advance the script on a loop, showing a typing indicator before each
    // agent line so it reads like a live call rather than a static block.
    function schedule(step: number) {
      if (step >= SCRIPT.length) {
        timers.current.push(
          setTimeout(() => {
            setVisible(1);
            schedule(1);
          }, 4200)
        );
        return;
      }

      const isAgent = SCRIPT[step].role === "agent";
      if (isAgent) setTyping(true);

      timers.current.push(
        setTimeout(
          () => {
            setTyping(false);
            setVisible(step + 1);
            schedule(step + 1);
          },
          isAgent ? 1600 : 1100
        )
      );
    }

    schedule(1);
    const scheduled = timers.current;
    return () => scheduled.forEach(clearTimeout);
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d20]/80 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,1)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
            <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
          </span>
          <div>
            <div className="text-[13.5px] font-medium text-slate-200">Live call</div>
            <div className="text-[11.5px] text-slate-500">ABC Plumbing · AI Receptionist</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[11.5px] text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          In progress
        </span>
      </div>

      <div className="min-h-[280px] space-y-3">
        {SCRIPT.slice(0, visible).map((turn, i) => (
          <div key={i} className={`flex gap-2.5 ${turn.role === "agent" ? "" : "flex-row-reverse"}`}>
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                turn.role === "agent" ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-white/10"
              }`}
            >
              {turn.role === "agent" ? (
                <Bot className="h-3 w-3 text-white" />
              ) : (
                <User className="h-3 w-3 text-slate-300" />
              )}
            </span>
            <p
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                turn.role === "agent" ? "bg-indigo-500/15 text-slate-100" : "bg-white/[0.06] text-slate-200"
              }`}
            >
              {turn.text}
            </p>
          </div>
        ))}

        {typing && (
          <div className="flex items-center gap-2 pl-9 text-slate-500">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <Chip tone="emerald">Lead captured</Chip>
        <Chip tone="orange">🔥 Score 92/100</Chip>
        <Chip tone="indigo">Appointment offered</Chip>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "emerald" | "orange" | "indigo" }) {
  const tones = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${tones[tone]}`}>{children}</span>
  );
}
