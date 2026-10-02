import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Clock, RotateCcw } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { can } from "../data/permissions";

const STATUS_META = {
  pending: { label: "Pending", icon: Clock, cls: "text-zinc-600" },
  queued: { label: "Queued", icon: Clock, cls: "text-zinc-500" },
  running: { label: "Running", icon: Loader2, cls: "text-sky-400 animate-spin" },
  success: { label: "Success", icon: CheckCircle2, cls: "text-emerald-400" },
  failed: { label: "Failed", icon: XCircle, cls: "text-red-400" },
};

export default function PipelineDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(() => {
    api.getPipeline(id).then(setRun).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    const onUpdated = (updated) => {
      if (updated.id === id) setRun(updated);
    };
    socket.on("pipeline:updated", onUpdated);
    return () => socket.off("pipeline:updated", onUpdated);
  }, [id]);

  async function rollback() {
    if (!window.confirm(`Roll back to this run (${run.commitSha || run.id.slice(0, 7)})? This creates a new simulated deploy run.`)) return;
    setRollingBack(true);
    setError(null);
    try {
      const newRun = await api.rollbackPipeline(id);
      navigate(`/pipelines/${newRun.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setRollingBack(false);
    }
  }

  if (!run) {
    return (
      <div className="h-full overflow-y-auto">
        <Header title="Pipeline run" subtitle="Loading..." />
        {error && <div className="m-6 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
      </div>
    );
  }

  const meta = STATUS_META[run.status] || STATUS_META.queued;
  const canRollback = can(activeOrg?.role, "PIPELINE_ROLLBACK") && run.status === "success" && run.trigger !== "rollback";

  return (
    <div className="h-full overflow-y-auto">
      <Header title={`${run.branch} — ${meta.label}`} subtitle={run.commitSha ? `${run.commitSha} · ${run.commitMessage}` : run.commitMessage} />
      <div className="p-6 max-w-2xl space-y-5">
        <button onClick={() => navigate("/pipelines")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Back to pipelines
        </button>

        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="px-1.5 py-0.5 rounded border border-zinc-700">{run.trigger}</span>
          <span className="px-1.5 py-0.5 rounded border border-zinc-700">{run.source}</span>
          {run.triggeredBy && <span>Triggered by {run.triggeredBy.name}</span>}
          {canRollback && (
            <button onClick={rollback} disabled={rollingBack}
              className="ml-auto flex items-center gap-1.5 border border-amber-800 text-amber-400 hover:bg-amber-950/30 disabled:opacity-50 text-xs font-medium px-3 py-1.5 rounded-md">
              <RotateCcw size={13} /> {rollingBack ? "Rolling back..." : "Roll back to this run"}
            </button>
          )}
        </div>

        {run.steps.length === 0 ? (
          <div className="text-sm text-zinc-600 border border-dashed border-zinc-800 rounded-md p-4">
            This run came from a GitHub webhook — step-by-step detail isn't available without
            the GitHub Actions API (needs a repo token), so only the overall status is shown.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {run.steps.map((step) => {
              const sMeta = STATUS_META[step.status] || STATUS_META.pending;
              const Icon = sMeta.icon;
              return (
                <div key={step.id} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={sMeta.cls} />
                    <span className="text-sm text-zinc-200 flex-1">{step.name}</span>
                    <span className="text-xs text-zinc-600">{sMeta.label}</span>
                  </div>
                  {step.log && (
                    <div className={`mt-2 ml-6 text-xs font-mono whitespace-pre-wrap ${step.status === "failed" ? "text-red-400" : "text-zinc-600"}`}>
                      {step.log}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
