import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { roleMeta } from "../data/roles";
import { columns } from "../data/mock";

export default function TaskDetailModal({ task, users, onClose, onUpdated }) {
  const [description, setDescription] = useState(task.description || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDescription(task.description || "");
    setAssigneeId(task.assigneeId || "");
    setStatus(task.status);
  }, [task]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateTask(task.id, { description, assigneeId: assigneeId || null, status });
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedUser = users.find((u) => u.id === assigneeId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800">
          <span className="text-sm text-zinc-300">Task details</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

          <div>
            <div className="text-sm text-zinc-100 font-medium">{task.title}</div>
            <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{task.points} pts</div>
          </div>

          <label className="block">
            <span className="text-xs text-zinc-500">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="No description yet..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-zinc-500">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">Assigned to</span>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Role:</span>
              <span className={`px-1.5 py-0.5 rounded border ${roleMeta(selectedUser.role).badge}`}>{roleMeta(selectedUser.role).label}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancel</button>
          <button onClick={save} disabled={saving} className="text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-medium px-3 py-1.5 rounded-md transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
