import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { severityMeta, bugStatusLabel, BUG_STATUSES } from "../data/bugMeta";

export default function BugTracker() {
  const { activeOrgId, activeOrg } = useOrg();
  const navigate = useNavigate();
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const upsertBug = useCallback((bug) => {
    setBugs((prev) => {
      const exists = prev.some((b) => b.id === bug.id);
      return exists ? prev.map((b) => (b.id === bug.id ? bug : b)) : [bug, ...prev];
    });
  }, []);

  const load = useCallback(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const params = {};
    if (severityFilter) params.severity = severityFilter;
    if (statusFilter) params.status = statusFilter;
    api.getBugs(params).then(setBugs).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [activeOrgId, severityFilter, statusFilter]);

  useEffect(load, [load]);

  useEffect(() => {
    const onBugEvent = (bug) => {
      if (bug.orgId === activeOrgId) upsertBug(bug);
    };
    socket.on("bug:created", onBugEvent);
    socket.on("bug:updated", onBugEvent);
    return () => {
      socket.off("bug:created", onBugEvent);
      socket.off("bug:updated", onBugEvent);
    };
  }, [activeOrgId, upsertBug]);

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Bugs" subtitle={activeOrg?.name || "Loading..."} />
      <div className="p-6">
        {error && <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="flex items-center gap-2 mb-5">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All statuses</option>
            {BUG_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium px-3 py-2 rounded-md transition-colors">
            <Plus size={15} /> Report bug
          </button>
        </div>

        {showForm && <NewBugForm onCreated={(b) => { upsertBug(b); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : bugs.length === 0 ? (
          <div className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-md p-6 text-center">No bugs match these filters.</div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {bugs.map((bug) => {
              const sev = severityMeta(bug.severity);
              return (
                <div key={bug.id} onClick={() => navigate(`/bugs/${bug.id}`)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${sev.badge}`}>{sev.label}</span>
                  <span className="text-sm text-zinc-200 flex-1 truncate">{bug.title}</span>
                  <span className="text-xs text-zinc-600 shrink-0">{bugStatusLabel(bug.status)}</span>
                  {bug.assignee && (
                    <div className={`h-5 w-5 rounded-full ${bug.assignee.color} flex items-center justify-center text-[9px] font-mono text-zinc-950 shrink-0`}>
                      {bug.assignee.initials}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NewBugForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const bug = await api.createBug({ title: title.trim(), description, severity });
      onCreated(bug);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bug title" required
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's happening?"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none" />
      <div className="flex items-center gap-2">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancel</button>
        <button type="submit" disabled={submitting} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium px-4 py-2 rounded-md transition-colors">
          {submitting ? "Reporting..." : "Report"}
        </button>
      </div>
    </form>
  );
}
