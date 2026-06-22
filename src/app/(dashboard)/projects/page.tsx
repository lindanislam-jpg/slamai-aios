"use client";

import { useEffect, useState } from "react";
import Header from "@/components/dashboard/Header";
import { Kanban, Plus, Check, Circle, AlertCircle, Loader2, X, Calendar, User } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface Task  { id: string; title: string; status: string; priority: string; dueDate?: string; }
interface Project { id: string; name: string; description?: string; status: string; tasks: Task[]; createdAt: string; }

const columns = [
  { id: "todo",        label: "To Do",       color: "border-slate-600", dotColor: "bg-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-blue-600",  dotColor: "bg-blue-400"  },
  { id: "done",        label: "Done",        color: "border-green-600", dotColor: "bg-green-400" },
];

const priorityColors: Record<string, string> = {
  low:    "text-slate-400",
  medium: "text-yellow-400",
  high:   "text-red-400",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active,   setActive]   = useState<Project | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [name,     setName]     = useState("");
  const [desc,     setDesc]     = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      const r = await axios.get("/api/projects");
      setProjects(r.data);
      if (r.data.length > 0) setActive(r.data[0]);
    } catch { toast.error("Failed to load projects"); }
    finally { setLoading(false); }
  }

  async function createProject() {
    if (!name) return;
    setSaving(true);
    try {
      const r = await axios.post("/api/projects", { name, description: desc });
      const newProj = { ...r.data, tasks: [] };
      setProjects(p => [newProj, ...p]);
      setActive(newProj);
      setShowNew(false);
      setName(""); setDesc("");
      toast.success("Project created!");
    } catch { toast.error("Failed to create project"); }
    finally { setSaving(false); }
  }

  const tasksByStatus = (tasks: Task[], status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="flex flex-col h-full">
      <Header title="Project Management" />
      <div className="flex flex-1 overflow-hidden">

        {/* Projects sidebar */}
        <div className="w-56 border-r border-slam-border bg-slam-card flex flex-col">
          <div className="p-4 border-b border-slam-border flex items-center justify-between">
            <span className="text-sm font-semibold">Projects</span>
            <button onClick={() => setShowNew(true)} className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center hover:bg-brand-700">
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>
            ) : projects.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-600">No projects yet</div>
            ) : projects.map(p => (
              <button key={p.id} onClick={() => setActive(p)} className={`w-full text-left px-4 py-3 transition-colors hover:bg-slam-dark/50 ${active?.id === p.id ? "bg-brand-600/10 border-l-2 border-brand-500" : ""}`}>
                <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.tasks.length} tasks</div>
              </button>
            ))}
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto p-6">
          {!active ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
              <Kanban className="w-16 h-16" />
              <p>Select or create a project to view the board</p>
              <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-4 h-4 mr-2 inline" />New Project</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{active.name}</h2>
                  {active.description && <p className="text-sm text-slate-400 mt-1">{active.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${active.status === "active" ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}`}>{active.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 min-w-[600px]">
                {columns.map(col => {
                  const tasks = tasksByStatus(active.tasks, col.id);
                  return (
                    <div key={col.id} className={`bg-slam-card rounded-xl border-t-2 ${col.color} p-4`}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                        <span className="text-sm font-semibold">{col.label}</span>
                        <span className="ml-auto text-xs bg-slam-dark px-2 py-0.5 rounded-full text-slate-500">{tasks.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[100px]">
                        {tasks.map(t => (
                          <div key={t.id} className="bg-slam-dark border border-slam-border rounded-lg p-3 text-sm hover:border-slate-600 transition-colors cursor-pointer">
                            <div className="flex items-start gap-2">
                              {t.status === "done" ? <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> : t.priority === "high" ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />}
                              <div className="flex-1">
                                <p className="text-slate-200 leading-snug">{t.title}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`text-xs ${priorityColors[t.priority] || "text-slate-500"}`}>{t.priority}</span>
                                  {t.dueDate && <span className="text-xs text-slate-600 flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(t.dueDate).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {tasks.length === 0 && <div className="text-xs text-slate-700 text-center py-4">No tasks</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Demo tasks notice */}
              {active.tasks.length === 0 && (
                <div className="mt-6 glass rounded-xl p-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-brand-400" />
                  <p className="text-sm text-slate-400">Add tasks to this project using the API or via the task creation form — coming in the next update.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New project modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slam-border">
              <h2 className="font-bold">New Project</h2>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Project Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign Q3" className="input-field" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What is this project about?" className="input-field min-h-[80px] resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createProject} disabled={!name || saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
