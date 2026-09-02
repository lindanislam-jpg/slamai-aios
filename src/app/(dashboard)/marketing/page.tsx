"use client";

import { useState, useEffect } from "react";
import Header from "@/components/dashboard/Header";
import { Megaphone, Sparkles, Copy, Check, Loader2, Linkedin, Twitter, Instagram, Mail, FileText, Video, Mic2, MousePointerClick, Trash2, Clock } from "lucide-react";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import { formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";
import axios from "axios";

const contentTypes = [
  { type: "linkedin",     label: "LinkedIn Post",   icon: Linkedin,          color: "from-blue-600 to-blue-800" },
  { type: "instagram",    label: "Instagram",        icon: Instagram,         color: "from-pink-500 to-rose-600" },
  { type: "facebook",     label: "Facebook Post",   icon: Twitter,           color: "from-blue-500 to-cyan-600" },
  { type: "blog",         label: "Blog Article",    icon: FileText,          color: "from-purple-500 to-indigo-600" },
  { type: "email",        label: "Email Campaign",  icon: Mail,              color: "from-green-500 to-emerald-600" },
  { type: "ad-copy",      label: "Ad Copy",         icon: MousePointerClick, color: "from-yellow-500 to-orange-600" },
  { type: "video-script", label: "Video Script",    icon: Video,             color: "from-red-500 to-rose-600" },
  { type: "podcast",      label: "Podcast Script",  icon: Mic2,              color: "from-teal-500 to-green-600" },
];

const tones = ["Professional", "Casual", "Humorous", "Inspirational", "Urgent", "Educational"];

interface Campaign {
  id: string; name: string; type: string; status: string; content: string | null; createdAt: string;
}

export default function MarketingPage() {
  const [type,      setType]     = useState("linkedin");
  const [topic,     setTopic]    = useState("");
  const [tone,      setTone]     = useState("Professional");
  const [audience,  setAudience] = useState("");
  const [content,   setContent]  = useState("");
  const [loading,   setLoading]  = useState(false);
  const [copied,    setCopied]   = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [deleting,  setDeleting] = useState(false);

  useEffect(() => {
    axios.get<Campaign[]>("/api/marketing/campaigns")
      .then(r => setCampaigns(r.data))
      .catch(() => {});
  }, []);

  async function generate() {
    if (!topic) { toast.error("Enter a topic first"); return; }
    setLoading(true);
    setContent("");
    try {
      const r = await axios.post("/api/marketing/generate", { type, topic, tone, audience });
      setContent(r.data.content);
      // Saved as a draft campaign server-side; reflect that without a refetch.
      if (r.data.campaign) setCampaigns(c => [r.data.campaign, ...c]);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      toast.error(status === 503
        ? "AI is not configured on the server yet"
        : "Failed to generate content");
    }
    finally { setLoading(false); }
  }

  async function deleteCampaign() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/marketing/campaigns/${pendingDelete.id}`);
      setCampaigns(c => c.filter(x => x.id !== pendingDelete.id));
      toast.success("Campaign deleted");
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete campaign");
    } finally { setDeleting(false); }
  }

  function copyContent() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedType = contentTypes.find(t => t.type === type)!;

  return (
    <div className="flex flex-col h-full">
      <Header title="Marketing AI" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Content type selector */}
        <div>
          <h3 className="font-semibold mb-3">Content Type</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {contentTypes.map(ct => (
              <button key={ct.type} onClick={() => setType(ct.type)} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${type === ct.type ? "border-brand-500 bg-brand-500/10" : "border-slam-border hover:border-slate-600 bg-slam-card"}`}>
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ct.color} flex items-center justify-center`}>
                  <ct.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-center text-slate-400 leading-tight">{ct.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <h3 className="font-semibold flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${selectedType.color} flex items-center justify-center`}>
                <selectedType.icon className="w-3.5 h-3.5 text-white" />
              </div>
              {selectedType.label} Generator
            </h3>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Topic / Product *</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={`e.g. "Our new AI-powered CRM helps small businesses close 3x more deals"`}
                className="input-field min-h-[100px] resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Tone</label>
              <div className="flex flex-wrap gap-2">
                {tones.map(t => (
                  <button key={t} onClick={() => setTone(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tone === t ? "bg-brand-600 text-white" : "bg-slam-dark border border-slam-border text-slate-400 hover:text-slate-200"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Target Audience</label>
              <input
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="e.g. Small business owners, SaaS founders, HR managers"
                className="input-field"
              />
            </div>

            <button onClick={generate} disabled={!topic || loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate Content</>}
            </button>
          </div>

          {/* Output */}
          <div className="glass rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Generated Content</h3>
              {content && (
                <button onClick={copyContent} className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                  {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Sparkles className="w-8 h-8 text-brand-400 animate-pulse" />
                <p className="text-sm">AI is crafting your content…</p>
              </div>
            ) : content ? (
              <div className="flex-1 bg-slam-dark rounded-xl p-4 overflow-y-auto">
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
                <Megaphone className="w-12 h-12" />
                <p className="text-sm text-center">Enter your topic and click Generate Content<br />to create AI-powered marketing copy</p>
              </div>
            )}

            {content && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-slam-border">
                <button className="flex-1 btn-secondary text-sm py-2">Schedule Post</button>
                <button className="flex-1 btn-primary text-sm py-2" onClick={generate}>Regenerate</button>
              </div>
            )}
          </div>
        </div>

        {/* Saved campaigns */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-semibold">Saved Campaigns</h3>
            <span className="text-xs text-slate-600">{campaigns.length} saved</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Everything you generate is kept here as a draft.</p>
          {campaigns.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-sm text-slate-600">
              Nothing generated yet. Your campaigns will appear here once you create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {campaigns.map(c => {
                const meta = contentTypes.find(t => t.type === c.type);
                const Icon = meta?.icon ?? Megaphone;
                return (
                  <div key={c.id} className="glass rounded-xl p-4 card-hover flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                        <h4 className="font-medium text-sm truncate">{c.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 capitalize flex-shrink-0">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-3 flex-1">{c.content?.slice(0, 160)}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slam-border/60">
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{formatRelativeTime(c.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setContent(c.content ?? ""); setTopic(c.name); }}
                          className="text-xs text-brand-400 hover:text-brand-300 px-1.5 py-0.5"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => setPendingDelete(c)}
                          aria-label={`Delete ${c.name}`}
                          className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete campaign?"
        message={`${pendingDelete?.name ?? "This campaign"} and its generated copy will be permanently removed.`}
        busy={deleting}
        onConfirm={deleteCampaign}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
