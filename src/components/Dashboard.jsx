import { useState, useEffect } from "react";
import { Columns3, GitPullRequest, Bug, Circle } from "lucide-react";
import Header from "./Header";
import { api } from "../api";

// PRs / bugs / activity feed have no backend module yet (out of trimmed scope) — static for now.
const staticStats = [
  { label: "Open PRs", value: 2, icon: GitPullRequest },
  { label: "Open bugs", value: 3, icon: Bug },
];

const activity = [
  { text: "Priya N moved \u201cDiff viewer syntax highlight\u201d to In Progress", time: "5m ago" },
  { text: "Arjun K commented on PR #14", time: "22m ago" },
  { text: "Rhea S closed bug \u201cLogin redirect loop\u201d", time: "1h ago" },
  { text: "Priya N created task \u201cAdd pagination to bug list\u201d", time: "2h ago" },
];

export default function Dashboard() {
  const [openTasks, setOpenTasks] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getTasks()
      .then((tasks) => !cancelled && setOpenTasks(tasks.filter((t) => t.status !== "done").length))
      .catch(() => !cancelled && setOpenTasks(0));
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: "Open tasks", value: openTasks ?? "…", icon: Columns3 },
    ...staticStats,
  ];

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Dashboard" subtitle="devflow-team / core-platform" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{s.label}</span>
                  <Icon size={14} className="text-zinc-600" />
                </div>
                <div className="mt-2 font-mono text-2xl text-zinc-50">{s.value}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300">
            Recent activity
          </div>
          <ul className="divide-y divide-zinc-800">
            {activity.map((a, i) => (
              <li key={i} className="px-4 py-3 flex items-start gap-2 text-sm">
                <Circle size={6} className="mt-1.5 text-emerald-500 fill-emerald-500 shrink-0" />
                <span className="text-zinc-300 flex-1">{a.text}</span>
                <span className="text-zinc-600 text-xs shrink-0">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
