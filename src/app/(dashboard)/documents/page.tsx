"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Header from "@/components/dashboard/Header";
import { FileText, Upload, Loader2, Sparkles, Copy, Check, Brain, FileSearch, ListFilter, MessageSquare, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import { useResource, mutate } from "@/lib/useApi";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/States";
import { formatRelativeTime, formatBytes } from "@/lib/utils";

interface SavedDocument {
  id: string; name: string; type: string; size: number;
  summary: string | null; createdAt: string;
}

const modes = [
  { id: "summarize", label: "Summarize",    icon: FileText,   desc: "Get a comprehensive summary" },
  { id: "extract",   label: "Extract Data", icon: ListFilter, desc: "Extract key facts and numbers" },
  { id: "analyze",   label: "Deep Analyze", icon: Brain,      desc: "Identify insights and risks" },
  { id: "qa",        label: "Q&A",          icon: MessageSquare, desc: "Ask questions about the doc" },
];

export default function DocumentsPage() {
  const [text,     setText]    = useState("");
  const [fileName, setFileName]= useState("");
  const [mode,     setMode]    = useState("summarize");
  const [question, setQuestion]= useState("");
  const [result,   setResult]  = useState("");
  const [loading,  setLoading] = useState(false);
  const [copied,   setCopied]  = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [fileSize, setFileSize]= useState(0);

  const documents = useResource<SavedDocument[]>("/api/documents");

  async function saveDocument() {
    if (!result) return;
    setSaving(true);
    try {
      await mutate("/api/documents", "POST", {
        name:    fileName || `Pasted document — ${new Date().toLocaleDateString("en-IE")}`,
        type:    fileName.split(".").pop()?.toLowerCase() || "text",
        size:    fileSize || text.length,
        summary: result,
      });
      await documents.refresh();
      toast.success("Analysis saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the analysis");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    try {
      await mutate(`/api/documents/${id}`, "DELETE");
      await documents.refresh();
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the document");
    }
  }

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      toast.success(`Loaded: ${file.name}`);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [".txt", ".md", ".csv"], "application/json": [".json"] },
    maxFiles: 1,
  });

  async function analyze() {
    if (!text) { toast.error("Please upload or paste a document first"); return; }
    setLoading(true);
    setResult("");
    try {
      const r = await axios.post("/api/documents/analyze", { text, mode, question });
      setResult(r.data.result);
    } catch { toast.error("Analysis failed"); }
    finally { setLoading(false); }
  }

  function copy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Document Intelligence" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload / paste */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <h3 className="font-semibold">Upload Document</h3>

            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "border-brand-500 bg-brand-500/5" : "border-slam-border hover:border-slate-500"}`}>
              <input {...getInputProps()} />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? "text-brand-400" : "text-slate-600"}`} />
              {fileName ? (
                <p className="text-sm text-brand-400 font-medium">{fileName}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-400">Drop a file here, or <span className="text-brand-400">browse</span></p>
                  <p className="text-xs text-slate-600 mt-1">TXT, MD, CSV, JSON supported</p>
                </>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center"><div className="w-full border-t border-slam-border" /></div>
              <div className="relative text-center"><span className="bg-slam-card px-3 text-xs text-slate-600">or paste text</span></div>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste document content here…"
              className="input-field min-h-[150px] resize-none text-sm"
            />

            {/* Mode */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Analysis Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {modes.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${mode === m.id ? "border-brand-500 bg-brand-500/10" : "border-slam-border hover:border-slate-600"}`}>
                    <m.icon className={`w-4 h-4 ${mode === m.id ? "text-brand-400" : "text-slate-500"}`} />
                    <div>
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-xs text-slate-600">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {mode === "qa" && (
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Your Question</label>
                <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="What does this document say about…?" className="input-field" />
              </div>
            )}

            <button onClick={analyze} disabled={!text || loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</> : <><Sparkles className="w-4 h-4" />Analyze Document</>}
            </button>
          </div>

          {/* Results */}
          <div className="glass rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">AI Analysis</h3>
              {result && (
                <button onClick={copy} className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300">
                  {copied ? <><Check className="w-4 h-4" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Brain className="w-10 h-10 text-brand-400 animate-pulse" />
                <p className="text-sm">AI is analyzing your document…</p>
              </div>
            ) : result ? (
              <>
                <div className="flex-1 bg-slam-dark rounded-xl p-4 overflow-y-auto">
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
                </div>
                <button
                  onClick={saveDocument}
                  disabled={saving}
                  className="btn-secondary text-sm py-2 mt-4 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Analysis
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
                <FileSearch className="w-12 h-12" />
                <p className="text-sm text-center">Upload a document and select an analysis mode<br />to unlock AI-powered document intelligence</p>
              </div>
            )}
          </div>
        </div>

        {/* Saved documents */}
        <div>
          <h3 className="font-semibold mb-4">Saved Analyses</h3>

          {documents.loading ? (
            <LoadingState label="Loading your documents…" />
          ) : documents.error ? (
            <ErrorState message={documents.error} onRetry={documents.refresh} />
          ) : (documents.data ?? []).length === 0 ? (
            <div className="glass rounded-2xl">
              <EmptyState
                icon={FileSearch}
                title="Nothing saved yet"
                description="Analyse a document above and hit Save Analysis to keep it here."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(documents.data ?? []).map((d) => (
                <div key={d.id} className="glass rounded-xl p-4 card-hover flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate">{d.name}</h4>
                      <p className="text-xs text-slate-600">
                        {d.type.toUpperCase()} · {formatBytes(d.size)} · {formatRelativeTime(d.createdAt)}
                      </p>
                    </div>
                  </div>
                  {d.summary && <p className="text-xs text-slate-500 line-clamp-4 flex-1">{d.summary}</p>}
                  <button
                    onClick={() => deleteDocument(d.id)}
                    className="mt-3 text-xs text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1 self-start"
                  >
                    <Trash2 className="w-3 h-3" />Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
