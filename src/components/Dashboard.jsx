import { useState, useEffect } from "react";
import { Columns3, GitPullRequest, Bug, Circle } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { useOrg } from "../context/OrgContext";

const activity = [
  { text: "Priya N moved \u201cDiff viewer syntax highlight\u201d to In Progress", time: "5m ago" },
  { text: "Arjun K commented on PR #14", time: "22m ago" },
  { text: "Rhea S closed bug \u201cLogin redirect loop\u201d", time: "1h ago" },
  { text: "Priya N created task \u201cAdd pagination to bug list\u201d", time: "2h ago" },
];

export default function Dashboard() {
  const { activeOrg, activeOrgId } = useOrg();
  const [counts, setCounts] = useState({ tasks: null, bugs: null, prs: null });

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    setCounts({ tasks: null, bugs: null, prs: null });

    Promise.all([api.getTasks(), api.getBugs(), api.getReviews()])
      .then(([tasks, bugs, reviews]) => {
        if (cancelled) return;
        setCounts({
          tasks: tasks.filter((t) => t.status !== "done").length,
          bugs: bugs.filter((b) => b.status !== "closed" && b.status !== "fixed").length,
          prs: reviews.filter((r) => r.status === "open").length,
        });
      })
      .catch(() => !cancelled && setCounts({ tasks: 0, bugs: 0, prs: 0 }));

    return () => {
      cancelled = true;
    };
  }, [activeOrgId]);

  const stats = [
    { label: "Open tasks", value: counts.tasks ?? "…", icon: Columns3 },
    { label: "Open PRs", value: counts.prs ?? "…", icon: GitPullRequest },
    { label: "Open bugs", value: counts.bugs ?? "…", icon: Bug },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Dashboard" subtitle={activeOrg?.name || "Loading..."} />
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
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300">Recent activity</div>
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
