"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen, FileText, Globe, HelpCircle, Plus, RefreshCw, Trash2, Type, Upload,
} from "lucide-react";
import { useApi, api, errorMessage } from "@/lib/voice/client";
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, Input, Loading, Modal,
  PageHeader, Table, Td, Textarea, Th,
} from "@/components/voice/ui";
import { formatBytes, formatDate } from "@/lib/utils";

type Source = {
  id: string; title: string; type: string; sourceUrl: string | null; status: string;
  error: string | null; chunkCount: number; bytes: number;
  lastIndexedAt: string | null; createdAt: string;
};

const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  url: { icon: Globe, label: "Website" },
  pdf: { icon: FileText, label: "PDF" },
  docx: { icon: FileText, label: "Word" },
  txt: { icon: FileText, label: "Text file" },
  faq: { icon: HelpCircle, label: "FAQ" },
  text: { icon: Type, label: "Written by you" },
};

export default function KnowledgePage() {
  const { data, loading, error, refresh } = useApi<{ sources: Source[] }>("/api/v1/knowledge");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sources = data?.sources ?? [];

  async function reindex(id: string) {
    setBusyId(id);
    try {
      await api(`/api/v1/knowledge/${id}/reindex`, "POST");
      toast.success("Refreshed");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/api/v1/knowledge/${id}`, "DELETE");
      toast.success("Removed");
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="What your AI knows"
        description="Add your website, price lists, policies and FAQs. Your AI answers from these and nothing else — it will never make something up."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add knowledge</Button>}
      />

      {loading ? (
        <Loading label="Loading your knowledge base…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Your AI doesn't know anything about you yet"
          description="Add your website address and it will read your pages in a few seconds. Most businesses start there, then add a price list and their FAQs."
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add your first source</Button>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Passages</Th>
                <Th>Added</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const meta = TYPE_META[source.type] ?? TYPE_META.text;
                const Icon = meta.icon;
                return (
                  <tr key={source.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-200">{source.title}</div>
                          {source.sourceUrl && (
                            <div className="truncate text-[12px] text-slate-500">{source.sourceUrl}</div>
                          )}
                          {source.error && (
                            <div className="mt-0.5 text-[12px] text-rose-400">{source.error}</div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[13px] text-slate-400">{meta.label}</Td>
                    <Td>
                      <Badge
                        tone={
                          source.status === "ready" ? "success" : source.status === "failed" ? "danger" : "warning"
                        }
                      >
                        {source.status === "ready" ? "Ready" : source.status === "failed" ? "Failed" : "Processing"}
                      </Badge>
                    </Td>
                    <Td className="text-[13px] text-slate-400">
                      {source.chunkCount}
                      <span className="ml-1.5 text-slate-600">{formatBytes(source.bytes)}</span>
                    </Td>
                    <Td className="text-[13px] text-slate-400">{formatDate(source.createdAt)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === source.id}
                          onClick={() => reindex(source.id)}
                          aria-label="Refresh this source"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(source.id)}
                          aria-label="Remove this source"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <AddKnowledgeModal open={adding} onClose={() => setAdding(false)} onAdded={refresh} />
    </>
  );
}

function AddKnowledgeModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"url" | "file" | "faq" | "text">("url");
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [faqs, setFaqs] = useState([{ question: "", answer: "" }]);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setUrl(""); setTitle(""); setText(""); setFaqs([{ question: "", answer: "" }]);
  }

  async function submit() {
    setSaving(true);
    try {
      if (mode === "file") {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error("Choose a file to upload.");
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());

        const response = await fetch("/api/v1/knowledge", { method: "POST", body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Upload failed.");
      } else if (mode === "url") {
        await api("/api/v1/knowledge", "POST", {
          title: title.trim() || url.replace(/^https?:\/\//, "").slice(0, 60),
          type: "url",
          sourceUrl: url.trim(),
        });
      } else if (mode === "faq") {
        const cleaned = faqs.filter((f) => f.question.trim() && f.answer.trim());
        if (cleaned.length === 0) throw new Error("Add at least one question and answer.");
        await api("/api/v1/knowledge", "POST", {
          title: title.trim() || "Frequently asked questions",
          type: "faq",
          faqs: cleaned,
        });
      } else {
        await api("/api/v1/knowledge", "POST", {
          title: title.trim() || "Business information",
          type: "text",
          content: text,
        });
      }

      toast.success("Added — your AI can use this now.");
      reset();
      onAdded();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const modes = [
    { key: "url" as const, label: "Website", icon: Globe },
    { key: "file" as const, label: "Upload", icon: Upload },
    { key: "faq" as const, label: "FAQ", icon: HelpCircle },
    { key: "text" as const, label: "Write it", icon: Type },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Add knowledge"
      description="Your AI reads this and quotes from it on calls."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={submit}>Add and index</Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[13px] transition-colors ${
                mode === m.key
                  ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                  : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/20"
              }`}
            >
              <Icon className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {mode === "url" && (
          <>
            <Field label="Web address" required hint="We read the page text. Add your services and about pages separately.">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourbusiness.ie/services" />
            </Field>
            <Field label="Name it (optional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Our services" />
            </Field>
          </>
        )}

        {mode === "file" && (
          <>
            <Field label="File" required hint="PDF, Word, or plain text, up to 10 MB. We keep only the text, not the file.">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="w-full rounded-xl border border-dashed border-white/15 bg-[#0e0e1f] px-3.5 py-6 text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-[13px] file:text-white"
              />
            </Field>
            <Field label="Name it (optional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2026 price list" />
            </Field>
          </>
        )}

        {mode === "faq" && (
          <>
            <Field label="Name it (optional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Common questions" />
            </Field>
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-xl border border-white/[0.07] p-3.5">
                <Input
                  value={faq.question}
                  onChange={(e) =>
                    setFaqs((f) => f.map((item, i) => (i === index ? { ...item, question: e.target.value } : item)))
                  }
                  placeholder="Do you charge a call-out fee?"
                />
                <Textarea
                  className="mt-2"
                  rows={2}
                  value={faq.answer}
                  onChange={(e) =>
                    setFaqs((f) => f.map((item, i) => (i === index ? { ...item, answer: e.target.value } : item)))
                  }
                  placeholder="Yes — €60, which comes off the bill if you go ahead with the work."
                />
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}>
              Add another
            </Button>
          </>
        )}

        {mode === "text" && (
          <>
            <Field label="Name it (optional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How we work" />
            </Field>
            <Field label="What should your AI know?" required>
              <Textarea
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "We cover Dublin, Kildare and Meath.\nCall-out fee is €60 and comes off the final bill.\nWe don't work on commercial boilers.\nEmergency cover is 7am to 11pm, seven days."
                }
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
