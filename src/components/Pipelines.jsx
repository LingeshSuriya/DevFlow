import { useState, useEffect, useCallback } from "react";
import { Play, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { can } from "../data/permissions";

const STATUS_META = {
  queued: { label: "Queued", icon: Clock, cls: "text-zinc-500" },
  running: { label: "Running", icon: Loader2, cls: "text-sky-400 animate-spin" },
  success: { label: "Success", icon: CheckCircle2, cls: "text-emerald-400" },
  failed: { label: "Failed", icon: XCircle, cls: "text-red-400" },
};

export default function Pipelines() {
  const { activeOrgId, activeOrg } = useOrg();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const upsertRun = useCallback((run) => {
    setRuns((prev) => {
      const exists = prev.some((r) => r.id === run.id);
      return exists ? prev.map((r) => (r.id === run.id ? run : r)) : [run, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    api.getPipelines().then(setRuns).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [activeOrgId]);

  useEffect(() => {
    const onEvent = (r) => {
      if (r.orgId === activeOrgId) upsertRun(r);
    };
    socket.on("pipeline:updated", onEvent);
    return () => socket.off("pipeline:updated", onEvent);
  }, [activeOrgId, upsertRun]);

  async function simulate(willFail) {
    setSimulating(true);
    setError(null);
    try {
      const run = await api.simulatePipeline({ branch: "main", willFail });
      upsertRun(run);
    } catch (e) {
      setError(e.message);
    } finally {
      setSimulating(false);
    }
  }

  const canTrigger = can(activeOrg?.role, "PIPELINE_TRIGGER");
  const successCount = runs.filter((r) => r.status === "success").length;
  const total = runs.filter((r) => r.status === "success" || r.status === "failed").length;
  const successRate = total ? Math.round((successCount / total) * 100) : null;

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Pipelines" subtitle={activeOrg?.name || "Loading..."} />
      <div className="p-6">
        {error && <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="flex items-center gap-3 mb-5">
          <div className="text-xs text-zinc-500">
            {activeOrg?.githubRepoFullName ? (
              <>Connected to <span className="font-mono text-zinc-400">{activeOrg.githubRepoFullName}</span> — real runs arrive via webhook.</>
            ) : (
              <>No GitHub repo connected (set one in Organization) — simulate runs below to try this out.</>
            )}
          </div>
          <div className="flex-1" />
          {canTrigger && (
            <>
              <button onClick={() => simulate(false)} disabled={simulating}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium px-3 py-2 rounded-md transition-colors">
                <Play size={14} /> Simulate run
              </button>
              <button onClick={() => simulate(true)} disabled={simulating}
                className="flex items-center gap-1.5 border border-red-800 text-red-400 hover:bg-red-950/30 disabled:opacity-50 text-sm font-medium px-3 py-2 rounded-md transition-colors">
                <Play size={14} /> Simulate failure
              </button>
            </>
          )}
        </div>

        {successRate !== null && (
          <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-4">
            <div>
              <div className="text-xs text-zinc-500">Success rate</div>
              <div className="font-mono text-2xl text-zinc-50">{successRate}%</div>
            </div>
            <div className="text-xs text-zinc-600">{successCount} of {total} completed runs</div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-md p-6 text-center">No pipeline runs yet.</div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {runs.map((run) => {
              const meta = STATUS_META[run.status] || STATUS_META.queued;
              const Icon = meta.icon;
              return (
                <div key={run.id} onClick={() => navigate(`/pipelines/${run.id}`)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50">
                  <Icon size={15} className={`shrink-0 ${meta.cls}`} />
                  <span className="text-sm text-zinc-200 font-mono">{run.branch}</span>
                  {run.commitMessage && <span className="text-sm text-zinc-500 truncate flex-1">{run.commitMessage}</span>}
                  {!run.commitMessage && <span className="flex-1" />}
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 shrink-0">{run.trigger}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500 shrink-0">{run.source}</span>
                  <span className="text-xs text-zinc-600 shrink-0">{meta.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
