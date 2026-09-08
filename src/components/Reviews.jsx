import { useState, useEffect, useCallback } from "react";
import { Plus, GitPullRequest } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";

const STATUS_META = {
  open: { label: "Open", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  approved: { label: "Approved", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  changes_requested: { label: "Changes requested", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  merged: { label: "Merged", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

export default function Reviews() {
  const { activeOrgId, activeOrg } = useOrg();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const upsertReview = useCallback((r) => {
    setReviews((prev) => {
      const exists = prev.some((x) => x.id === r.id);
      return exists ? prev.map((x) => (x.id === r.id ? { ...x, ...r } : x)) : [r, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    api.getReviews().then(setReviews).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [activeOrgId]);

  useEffect(() => {
    const onEvent = (r) => {
      if (r.orgId === activeOrgId) upsertReview(r);
    };
    socket.on("review:created", onEvent);
    socket.on("review:updated", onEvent);
    return () => {
      socket.off("review:created", onEvent);
      socket.off("review:updated", onEvent);
    };
  }, [activeOrgId, upsertReview]);

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Code Review" subtitle={activeOrg?.name || "Loading..."} />
      <div className="p-6">
        {error && <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="flex justify-end mb-5">
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium px-3 py-2 rounded-md transition-colors">
            <Plus size={15} /> Import PR
          </button>
        </div>

        {showForm && <ImportForm onCreated={(r) => { upsertReview(r); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-md p-6 text-center">
            No PRs imported yet. Paste a public github.com PR URL to get started.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {reviews.map((r) => {
              const status = STATUS_META[r.status] || STATUS_META.open;
              return (
                <div key={r.id} onClick={() => navigate(`/reviews/${r.id}`)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50">
                  <GitPullRequest size={14} className="text-zinc-600 shrink-0" />
                  <span className="text-sm text-zinc-200 flex-1 truncate">{r.title}</span>
                  <span className="text-xs text-zinc-600 shrink-0">{r._count?.comments ?? 0} comments</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${status.badge}`}>{status.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportForm({ onCreated, onCancel }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!sourceUrl.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await api.createReview({ sourceUrl: sourceUrl.trim(), title: title.trim() || undefined });
      onCreated(review);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
      <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/owner/repo/pull/123" required
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional — defaults to owner/repo #N)"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      <p className="text-[11px] text-zinc-600">Public repos only — fetches the diff directly from GitHub, no token needed.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancel</button>
        <button type="submit" disabled={submitting} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium px-4 py-2 rounded-md transition-colors">
          {submitting ? "Importing..." : "Import"}
        </button>
      </div>
    </form>
  );
}
