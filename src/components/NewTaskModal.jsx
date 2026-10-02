import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { columns } from "../data/mock";
import { roleMeta } from "../data/roles";

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];

export default function NewTaskModal({ users, defaultAssigneeId, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId || "");
  const [points, setPoints] = useState(1);
  const [status, setStatus] = useState("todo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const task = await api.createTask({
        title: title.trim(),
        description,
        assigneeId: assigneeId || null,
        points,
        status,
      });
      onCreated(task);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selected = users.find((u) => u.id === assigneeId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800">
          <span className="text-sm text-zinc-300">New task</span>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

          <label className="block">
            <span className="text-xs text-zinc-500">Title</span>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Context, acceptance criteria, links..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-zinc-500">Assigned to</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({roleMeta(u.role).label})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">Story points</span>
              <select
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {POINT_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-zinc-500">Starting column</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {columns.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>

          {selected && (
            <p className="text-[11px] text-zinc-600">
              Once assigned, only {selected.name} (or an Owner/Admin) can edit or move this task.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancel</button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            {saving ? "Creating..." : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
