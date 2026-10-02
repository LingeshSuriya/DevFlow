import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { severityMeta, BUG_STATUSES } from "../data/bugMeta";
import { can } from "../data/permissions";

export default function BugDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const canEdit = can(activeOrg?.role, "BUG_WRITE");
  const [bug, setBug] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getBug(id), api.getUsers()])
      .then(([bugRes, usersRes]) => {
        setBug(bugRes);
        setUsers(usersRes);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    const onUpdated = (updated) => {
      if (updated.id === id) setBug((prev) => ({ ...prev, ...updated }));
    };
    const onComment = ({ bugId, comment }) => {
      if (bugId === id) setBug((prev) => (prev ? { ...prev, comments: [...(prev.comments || []), comment] } : prev));
    };
    socket.on("bug:updated", onUpdated);
    socket.on("bug:comment", onComment);
    return () => {
      socket.off("bug:updated", onUpdated);
      socket.off("bug:comment", onComment);
    };
  }, [id]);

  async function patch(data) {
    try {
      const updated = await api.updateBug(id, data);
      setBug((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function postComment(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await api.addBugComment(id, { text });
      setDraft("");
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  }

  if (!bug) {
    return (
      <div className="h-full overflow-y-auto">
        <Header title="Bug" subtitle="Loading..." />
        {error && <div className="m-6 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
      </div>
    );
  }

  const sev = severityMeta(bug.severity);
  const selectCls =
    "w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60";

  return (
    <div className="h-full overflow-y-auto">
      <Header title={bug.title} subtitle="Bug report" />
      <div className="p-6 max-w-3xl space-y-5">
        <button onClick={() => navigate("/bugs")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Back to bugs
        </button>

        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Severity">
            <select value={bug.severity} onChange={(e) => patch({ severity: e.target.value })} disabled={!canEdit} className={selectCls}>
              {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{severityMeta(s).label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={bug.status} onChange={(e) => patch({ status: e.target.value })} disabled={!canEdit} className={selectCls}>
              {BUG_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Assigned to">
            <select value={bug.assigneeId || ""} onChange={(e) => patch({ assigneeId: e.target.value || null })} disabled={!canEdit} className={selectCls}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className={`px-1.5 py-0.5 rounded border ${sev.badge}`}>{sev.label}</span>
          <span>Reported by {bug.reporter?.name}</span>
          {bug.linkedTask && (
            <span>· Linked to <Link to="/board" className="text-emerald-400 hover:underline">{bug.linkedTask.title}</Link></span>
          )}
        </div>

        {bug.description && <Section title="Description"><p className="text-sm text-zinc-300 whitespace-pre-wrap">{bug.description}</p></Section>}
        {bug.stepsToReproduce && <Section title="Steps to reproduce"><p className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">{bug.stepsToReproduce}</p></Section>}

        <Section title={`Comments (${bug.comments?.length || 0})`}>
          <div className="space-y-3 mb-3">
            {(bug.comments || []).map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <div className={`h-6 w-6 rounded-full ${c.user.color} flex items-center justify-center text-[9px] font-mono text-zinc-950 shrink-0`}>{c.user.initials}</div>
                <div>
                  <div className="text-xs text-zinc-300 font-medium">{c.user.name}</div>
                  <div className="text-sm text-zinc-400">{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={postComment} className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={canEdit ? "Add a comment..." : "Viewer role — read only"} disabled={!canEdit}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60" />
            <button type="submit" disabled={posting || !canEdit} className="h-9 w-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-md text-zinc-950 transition-colors">
              <Send size={15} />
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1.5">{title}</div>
      {children}
    </div>
  );
}
