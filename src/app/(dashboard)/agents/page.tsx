"use client";

import { useEffect, useState, useRef } from "react";
import Header from "@/components/dashboard/Header";
import { Bot, Plus, Send, Loader2, Sparkles, Trash2, MessageSquare, X, Brain, Headphones, TrendingUp, Search, DollarSign, Users, Settings2, Cpu } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface Agent { id: string; name: string; type: string; description?: string; isActive: boolean; }
interface Message { role: string; content: string; }

const agentTemplates = [
  { type: "customer-support", name: "Customer Support Agent", icon: Headphones,  desc: "Handles customer questions, complaints, and support tickets.", color: "from-blue-500 to-cyan-600",    systemPrompt: "You are a friendly, professional customer support agent. Resolve issues quickly and ensure customer satisfaction. Be empathetic and solution-focused." },
  { type: "sales",            name: "Sales Agent",            icon: TrendingUp,  desc: "Qualifies leads, follows up on prospects, closes deals.",      color: "from-green-500 to-emerald-600", systemPrompt: "You are an expert sales agent. Qualify leads, understand customer needs, present solutions, and guide prospects toward making a purchase decision. Be persuasive but not pushy." },
  { type: "marketing",        name: "Marketing Agent",        icon: Sparkles,    desc: "Creates campaigns, writes copy, schedules content.",           color: "from-pink-500 to-rose-600",     systemPrompt: "You are a creative marketing expert. Help create compelling campaigns, write engaging copy, and develop marketing strategies that drive growth." },
  { type: "research",         name: "Research Agent",         icon: Search,      desc: "Analyzes data, prepares reports, finds insights.",             color: "from-purple-500 to-indigo-600", systemPrompt: "You are an expert researcher and analyst. Gather information, analyze data, identify trends and patterns, and present findings in clear, actionable reports." },
  { type: "finance",          name: "Finance Agent",          icon: DollarSign,  desc: "Creates invoices, financial summaries, and budget reports.",   color: "from-yellow-500 to-orange-600", systemPrompt: "You are a finance and accounting specialist. Help with invoicing, financial analysis, budget planning, and financial reporting. Be precise and detail-oriented." },
  { type: "hr",               name: "HR Agent",               icon: Users,       desc: "Manages onboarding, documentation, and employee queries.",     color: "from-teal-500 to-green-600",    systemPrompt: "You are an experienced HR professional. Help with employee onboarding, HR policies, documentation, and creating a positive workplace culture." },
  { type: "operations",       name: "Operations Agent",       icon: Settings2,   desc: "Manages workflows, internal processes, and tasks.",            color: "from-orange-500 to-red-600",    systemPrompt: "You are an operations expert. Optimize processes, manage workflows, identify bottlenecks, and ensure efficient business operations." },
  { type: "custom",           name: "Custom Agent",           icon: Cpu,         desc: "Build your own AI agent with custom instructions.",           color: "from-slate-500 to-slate-700",   systemPrompt: "" },
];

export default function AgentsPage() {
  const [agents,      setAgents]      = useState<Agent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [convId,      setConvId]      = useState<string | null>(null);
  const [creating,    setCreating]    = useState(false);
  const [selected,    setSelected]    = useState<typeof agentTemplates[0] | null>(null);
  const [customName,  setCustomName]  = useState("");
  const [customPrompt,setCustomPrompt]= useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchAgents(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchAgents() {
    try {
      const r = await axios.get("/api/agents");
      setAgents(r.data);
    } catch { toast.error("Failed to load agents"); }
    finally { setLoading(false); }
  }

  async function createAgent() {
    if (!selected) return;
    setCreating(true);
    try {
      const name = selected.type === "custom" ? customName : selected.name;
      const r = await axios.post("/api/agents", {
        name, type: selected.type, description: selected.desc,
        systemPrompt: selected.type === "custom" ? customPrompt : selected.systemPrompt,
      });
      setAgents(prev => [r.data, ...prev]);
      setShowCreate(false);
      setSelected(null);
      setCustomName("");
      setCustomPrompt("");
      toast.success(`${name} deployed!`);
    } catch { toast.error("Failed to create agent"); }
    finally { setCreating(false); }
  }

  async function sendMessage() {
    if (!input.trim() || !activeAgent) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const r = await axios.post("/api/agents/chat", { agentId: activeAgent.id, message: userMsg, conversationId: convId });
      setMessages(prev => [...prev, { role: "assistant", content: r.data.reply }]);
      setConvId(r.data.conversationId);
    } catch { toast.error("Failed to get response"); setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error. Please try again." }]); }
    finally { setChatLoading(false); }
  }

  function openChat(agent: Agent) {
    setActiveAgent(agent);
    setMessages([{ role: "assistant", content: `Hi! I'm ${agent.name}. How can I help you today?` }]);
    setConvId(null);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Agent Hub" />
      <div className="flex-1 flex overflow-hidden">

        {/* Agent list */}
        <div className={`${activeAgent ? "hidden lg:flex" : "flex"} flex-col flex-1 p-6 gap-6 overflow-y-auto`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mt-1">Deploy specialized AI employees for every business function</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Deploy Agent
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
          ) : agents.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Bot className="w-12 h-12 text-brand-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agents deployed yet</h3>
              <p className="text-slate-400 mb-6">Deploy your first AI agent to start automating your business</p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">Deploy Your First Agent</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => {
                const tpl = agentTemplates.find(t => t.type === agent.type) || agentTemplates[agentTemplates.length - 1];
                return (
                  <div key={agent.id} className="glass rounded-xl p-5 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tpl.color} flex items-center justify-center`}>
                        <tpl.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-xs text-green-400">Active</span>
                      </div>
                    </div>
                    <h3 className="font-semibold mb-1">{agent.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">{agent.description || tpl.desc}</p>
                    <button onClick={() => openChat(agent)} className="w-full btn-secondary text-sm flex items-center justify-center gap-2 py-2">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat with Agent
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat panel */}
        {activeAgent && (
          <div className="flex flex-col w-full lg:w-96 border-l border-slam-border bg-slam-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slam-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-medium text-sm">{activeAgent.name}</div>
                  <div className="text-xs text-green-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400" />Online</div>
                </div>
              </div>
              <button onClick={() => setActiveAgent(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-brand-600 text-white rounded-br-sm" : "bg-slam-dark border border-slam-border text-slate-200 rounded-bl-sm"
                  }`}>
                    {m.role === "assistant" && <Brain className="w-3 h-3 text-brand-400 mb-1" />}
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slam-dark border border-slam-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slam-border">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message…"
                  className="flex-1 bg-slam-dark border border-slam-border rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
                <button onClick={sendMessage} disabled={!input.trim() || chatLoading} className="w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0">
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slam-border">
              <h2 className="font-bold text-xl">Deploy New AI Agent</h2>
              <button onClick={() => { setShowCreate(false); setSelected(null); }} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-slate-400 mb-6">Choose a specialized AI agent template or build your own</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {agentTemplates.map(t => (
                  <button key={t.type} onClick={() => setSelected(t)} className={`p-4 rounded-xl border-2 transition-all text-left ${selected?.type === t.type ? "border-brand-500 bg-brand-500/10" : "border-slam-border hover:border-slam-border/70 bg-slam-dark/50"}`}>
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center mb-3`}>
                      <t.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="font-medium text-sm mb-1">{t.name}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{t.desc}</div>
                  </button>
                ))}
              </div>
              {selected?.type === "custom" && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">Agent Name</label>
                    <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. My Research Agent" className="input-field" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-1.5 block">System Instructions</label>
                    <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Describe how this agent should behave and what it should help with…" className="input-field min-h-[100px] resize-none" />
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowCreate(false); setSelected(null); }} className="btn-secondary">Cancel</button>
                <button onClick={createAgent} disabled={!selected || creating || (selected.type === "custom" && !customName)} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Deploying…</> : <><Bot className="w-4 h-4" />Deploy Agent</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppress unused import warning */}
      <div className="hidden"><Trash2 /></div>
    </div>
  );
}
