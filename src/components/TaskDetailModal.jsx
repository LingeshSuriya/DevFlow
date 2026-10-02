import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { roleMeta } from "../data/roles";
import { columns } from "../data/mock";
import { getTaskCaps } from "../data/taskAccess";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];
const statusLabel = (key) => columns.find((c) => c.key === key)?.label || key;

export default function TaskDetailModal({ task, users, onClose, onUpdated }) {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const caps = getTaskCaps(activeOrg?.role, user?.id, task);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [points, setPoints] = useState(task.points);
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Send only what actually changed — the server re-validates each field against the rules.
  const changes = {};
  if (caps.canEdit) {
    if (title.trim() && title.trim() !== task.title) changes.title = title.trim();
    if (description !== (task.description || "")) changes.description = description;
    if (points !== task.points) changes.points = points;
  }
  if (status !== task.status) changes.status = status;
  if ((assigneeId || null) !== (task.assigneeId || null)) changes.assigneeId = assigneeId || null;
  const dirty = Object.keys(changes).length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateTask(task.id, changes);
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = [task.status, ...caps.moveTargets];
  const currentAssignee = users.find((u) => u.id === (assigneeId || null)) || null;
  const anythingEditable = caps.canEdit || caps.canReassign || caps.canClaim || caps.canRelease || caps.moveTargets.length > 0;
  const inputBase =
    "mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800">
          <span className="text-sm text-zinc-300">Task details</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
          {caps.hint && <div className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2">{caps.hint}</div>}

          <label className="block">
            <span className="text-xs text-zinc-500">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!caps.canEdit} className={inputBase} />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!caps.canEdit}
              placeholder="No description yet..."
              className={`${inputBase} px-3 placeholder-zinc-600 resize-none`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-zinc-500">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={caps.moveTargets.length === 0} className={inputBase}>
                {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">Story points</span>
              <select value={points} onChange={(e) => setPoints(Number(e.target.value))} disabled={!caps.canEdit} className={inputBase}>
                {POINT_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="text-xs text-zinc-500">Assigned to</span>
            {caps.canReassign ? (
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputBase}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({roleMeta(u.role).label})</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 flex items-center gap-2 min-h-[38px]">
                {currentAssignee ? (
                  <>
                    <div className={`h-6 w-6 rounded-full ${currentAssignee.color} flex items-center justify-center text-[9px] font-mono text-zinc-950`}>
                      {currentAssignee.initials}
                    </div>
                    <span className="text-sm text-zinc-200">{currentAssignee.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleMeta(currentAssignee.role).badge}`}>
                      {roleMeta(currentAssignee.role).label}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-zinc-600">Unassigned</span>
                )}
                {caps.canClaim && !assigneeId && (
                  <button type="button" onClick={() => setAssigneeId(user.id)} className="ml-auto text-xs text-emerald-400 hover:underline">
                    Claim this task
                  </button>
                )}
                {caps.canRelease && assigneeId === user.id && (
                  <button type="button" onClick={() => setAssigneeId("")} className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 hover:underline">
                    Release task
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">
            {anythingEditable ? "Cancel" : "Close"}
          </button>
          {anythingEditable && (
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
