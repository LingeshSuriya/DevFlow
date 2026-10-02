import { useState, useEffect } from "react";
import { Columns3, GitPullRequest, Bug, Circle, Activity as ActivityIcon } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { timeAgo } from "../lib/timeAgo";

const PIPELINE_STATUS_CLS = { success: "text-emerald-400", failed: "text-red-400", running: "text-sky-400", queued: "text-zinc-500" };

export default function Dashboard() {
  const { activeOrg, activeOrgId } = useOrg();
  const [counts, setCounts] = useState({ tasks: null, bugs: null, prs: null });
  const [lastPipeline, setLastPipeline] = useState(undefined); // undefined = loading, null = none yet
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

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
    return () => { cancelled = true; };
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    setLastPipeline(undefined);
    api.getPipelines().then((runs) => !cancelled && setLastPipeline(runs[0] || null)).catch(() => !cancelled && setLastPipeline(null));
    return () => { cancelled = true; };
  }, [activeOrgId]);

  useEffect(() => {
    const onPipeline = (run) => {
      if (run.orgId === activeOrgId) setLastPipeline((prev) => (!prev || new Date(run.createdAt) >= new Date(prev.createdAt) ? run : prev));
    };
    socket.on("pipeline:updated", onPipeline);
    return () => socket.off("pipeline:updated", onPipeline);
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    setActivityLoading(true);
    setActivity([]);
    api.getActivity(20).then((entries) => !cancelled && setActivity(entries)).catch(() => {}).finally(() => !cancelled && setActivityLoading(false));
    return () => { cancelled = true; };
  }, [activeOrgId]);

  useEffect(() => {
    const onNew = (entry) => {
      if (entry.orgId === activeOrgId) setActivity((prev) => [entry, ...prev].slice(0, 20));
    };
    socket.on("activity:new", onNew);
    return () => socket.off("activity:new", onNew);
  }, [activeOrgId]);

  const stats = [
    { label: "Open tasks", value: counts.tasks ?? "…", icon: Columns3 },
    { label: "Open PRs", value: counts.prs ?? "…", icon: GitPullRequest },
    { label: "Open bugs", value: counts.bugs ?? "…", icon: Bug },
    {
      label: "Last pipeline",
      value: lastPipeline === undefined ? "…" : lastPipeline === null ? "—" : lastPipeline.status,
      icon: ActivityIcon,
      valueCls: lastPipeline ? PIPELINE_STATUS_CLS[lastPipeline.status] || "" : "",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Dashboard" subtitle={activeOrg?.name || "Loading..."} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{s.label}</span>
                  <Icon size={14} className="text-zinc-600" />
                </div>
                <div className={`mt-2 font-mono text-2xl capitalize ${s.valueCls || "text-zinc-50"}`}>{s.value}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300">Recent activity</div>
          {activityLoading ? (
            <div className="px-4 py-6 text-sm text-zinc-600">Loading...</div>
          ) : activity.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-600">Nothing yet — create a task, report a bug, or import a review.</div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-start gap-2 text-sm">
                  <Circle size={6} className="mt-1.5 text-emerald-500 fill-emerald-500 shrink-0" />
                  <span className="text-zinc-300 flex-1">{a.summary}</span>
                  <span className="text-zinc-600 text-xs shrink-0">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
