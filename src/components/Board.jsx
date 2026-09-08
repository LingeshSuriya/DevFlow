import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronRight } from "lucide-react";
import Header from "./Header";
import TaskDetailModal from "./TaskDetailModal";
import { columns } from "../data/mock";
import { roleMeta } from "../data/roles";
import { api } from "../api";
import { socket } from "../socket";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";

export default function Board() {
  const { user } = useAuth();
  const { activeOrgId, activeOrg } = useOrg();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openTask, setOpenTask] = useState(null);

  const upsertTask = useCallback((task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      return exists ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task];
    });
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    setLoading(true);
    setTasks([]);
    Promise.all([api.getTasks(), api.getUsers()])
      .then(([tasksRes, usersRes]) => {
        if (cancelled) return;
        setTasks(tasksRes);
        setUsers(usersRes);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  useEffect(() => {
    const onTaskEvent = (task) => {
      if (task.orgId === activeOrgId) upsertTask(task);
    };
    socket.on("task:created", onTaskEvent);
    socket.on("task:moved", onTaskEvent);
    return () => {
      socket.off("task:created", onTaskEvent);
      socket.off("task:moved", onTaskEvent);
    };
  }, [activeOrgId, upsertTask]);

  async function moveTask(id, direction) {
    const task = tasks.find((t) => t.id === id);
    const idx = columns.findIndex((c) => c.key === task.status);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= columns.length) return;

    const nextStatus = columns[nextIdx].key;
    upsertTask({ ...task, status: nextStatus });
    try {
      await api.moveTask(id, nextStatus);
    } catch (e) {
      setError(e.message);
      upsertTask(task);
    }
  }

  async function addTask() {
    const title = draftTitle.trim();
    if (!title || !user) return;
    setDraftTitle("");
    try {
      const task = await api.createTask({ title, assigneeId: user.id, points: 1 });
      upsertTask(task);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div className="p-6 text-sm text-zinc-500">Loading board...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Board" subtitle={activeOrg ? `${activeOrg.name} — Sprint 4` : "Loading..."} />
      <div className="p-6">
        {error && <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
        <div className="flex gap-3 mb-5">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="New task title..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button onClick={addTask} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium px-3 py-2 rounded-md transition-colors">
            <Plus size={15} /> Add to Todo
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {columns.map((col, colIdx) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="min-w-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{col.label}</span>
                  <span className="text-xs text-zinc-600 font-mono">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {colTasks.map((t) => (
                    <TaskCard key={t.id} task={t} colIdx={colIdx} onMove={moveTask} onOpen={setOpenTask} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-xs text-zinc-700 border border-dashed border-zinc-800 rounded-md p-3 text-center">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openTask && (
        <TaskDetailModal task={openTask} users={users} onClose={() => setOpenTask(null)} onUpdated={upsertTask} />
      )}
    </div>
  );
}

function TaskCard({ task, colIdx, onMove, onOpen }) {
  const role = task.assignee ? roleMeta(task.assignee.role) : null;

  return (
    <div onClick={() => onOpen(task)} className="rounded-md border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors cursor-pointer">
      <div className="text-sm text-zinc-200 leading-snug">{task.title}</div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {task.assignee ? (
          <>
            <div className={`h-5 w-5 rounded-full ${task.assignee.color} flex items-center justify-center text-[9px] font-mono text-zinc-950`}>
              {task.assignee.initials}
            </div>
            {role && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${role.badge}`}>{role.label}</span>}
          </>
        ) : (
          <span className="text-[11px] text-zinc-600">Unassigned</span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] font-mono text-zinc-500">{task.points} pts</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={colIdx === 0} onClick={() => onMove(task.id, -1)} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:hover:text-zinc-600 rotate-180" title="Move left">
            <ChevronRight size={14} />
          </button>
          <button disabled={colIdx === columns.length - 1} onClick={() => onMove(task.id, 1)} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:hover:text-zinc-600" title="Move right">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
