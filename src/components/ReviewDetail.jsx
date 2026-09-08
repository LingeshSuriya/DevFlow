import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, MessageSquare, Send } from "lucide-react";
import Header from "./Header";
import DiffViewer from "./DiffViewer";
import { api } from "../api";
import { socket } from "../socket";
import { joinReviewRoom, leaveReviewRoom } from "../socket";

const STATUS_META = {
  open: { label: "Open", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  approved: { label: "Approved", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  changes_requested: { label: "Changes requested", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  merged: { label: "Merged", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);
  const [pendingLine, setPendingLine] = useState(null); // { fileName, lineLabel, text }
  const [commentDraft, setCommentDraft] = useState("");
  const [decisionDraft, setDecisionDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const commentsEndRef = useRef(null);

  const load = useCallback(() => {
    api.getReview(id).then(setReview).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    joinReviewRoom(id);
    const onUpdated = (updated) => {
      if (updated.id === id) setReview((prev) => (prev ? { ...prev, ...updated } : prev));
    };
    const onComment = ({ prId, comment }) => {
      if (prId === id) setReview((prev) => (prev ? { ...prev, comments: [...(prev.comments || []), comment] } : prev));
    };
    socket.on("review:updated", onUpdated);
    socket.on("review:comment", onComment);
    return () => {
      leaveReviewRoom(id);
      socket.off("review:updated", onUpdated);
      socket.off("review:comment", onComment);
    };
  }, [id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [review?.comments]);

  async function postLineComment(e) {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text || !pendingLine) return;
    setPosting(true);
    try {
      await api.addReviewComment(id, { text, fileName: pendingLine.fileName, lineLabel: pendingLine.lineLabel });
      setCommentDraft("");
      setPendingLine(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function submitDecision(status) {
    const text = decisionDraft.trim() || `Marked as ${STATUS_META[status].label.toLowerCase()}`;
    try {
      await api.addReviewComment(id, { text, isDecision: true });
      await api.updateReview(id, { status });
      setDecisionDraft("");
    } catch (e) {
      setError(e.message);
    }
  }

  if (!review) {
    return (
      <div className="h-full overflow-y-auto">
        <Header title="Review" subtitle="Loading..." />
        {error && <div className="m-6 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
      </div>
    );
  }

  const status = STATUS_META[review.status] || STATUS_META.open;

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-y-auto min-w-0">
        <Header title={review.title} subtitle={review.sourceUrl} />
        <div className="p-6">
          <button onClick={() => navigate("/reviews")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-4">
            <ArrowLeft size={13} /> Back to reviews
          </button>

          {error && <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

          <div className="flex items-center gap-3 mb-4 text-xs text-zinc-500">
            <span className={`px-1.5 py-0.5 rounded border ${status.badge}`}>{status.label}</span>
            <span>Imported by {review.author?.name}</span>
          </div>

          <DiffViewer
            diffText={review.diffText}
            onCommentLine={(fileName, lineLabel, text) => setPendingLine({ fileName, lineLabel, text })}
          />
        </div>
      </div>

      {/* Comments + decision sidebar */}
      <div className="w-80 shrink-0 border-l border-zinc-800 flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-zinc-800 text-sm text-zinc-300 gap-1.5">
          <MessageSquare size={14} /> Comments
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(review.comments || []).map((c) => (
            <div key={c.id} className={`text-sm ${c.isDecision ? "border-l-2 border-emerald-500 pl-2" : ""}`}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-zinc-300">{c.user.name}</span>
                {c.fileName && <span className="text-[10px] text-zinc-600 font-mono truncate">{c.fileName}</span>}
              </div>
              <div className="text-zinc-400">{c.text}</div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {pendingLine && (
          <form onSubmit={postLineComment} className="p-3 border-t border-zinc-800 space-y-2">
            <div className="text-[11px] text-zinc-600 font-mono truncate">
              {pendingLine.fileName} · line {pendingLine.lineLabel}
            </div>
            <textarea
              autoFocus
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={2}
              placeholder="Comment on this line..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingLine(null)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1">Cancel</button>
              <button type="submit" disabled={posting} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-medium px-3 py-1.5 rounded-md">
                Comment
              </button>
            </div>
          </form>
        )}

        <div className="p-3 border-t border-zinc-800 space-y-2">
          <textarea
            value={decisionDraft}
            onChange={(e) => setDecisionDraft(e.target.value)}
            rows={2}
            placeholder="Summary comment (optional)..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => submitDecision("approved")}
              className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-medium py-1.5 rounded-md">
              <Check size={13} /> Approve
            </button>
            <button onClick={() => submitDecision("changes_requested")}
              className="flex items-center justify-center gap-1.5 border border-amber-700 text-amber-400 hover:bg-amber-950/30 text-xs font-medium py-1.5 rounded-md">
              <X size={13} /> Request changes
            </button>
          </div>
          <button onClick={() => submitDecision("merged")} className="w-full flex items-center justify-center gap-1.5 border border-violet-700 text-violet-400 hover:bg-violet-950/30 text-xs font-medium py-1.5 rounded-md">
            <Send size={13} /> Mark merged
          </button>
        </div>
      </div>
    </div>
  );
}
