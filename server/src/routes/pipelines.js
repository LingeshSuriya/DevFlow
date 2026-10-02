import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";
import { requirePermission } from "../middleware/permission.js";
import { logActivity } from "../lib/activity.js";

const runInclude = { triggeredBy: true, steps: { orderBy: { position: "asc" } } };

const DEMO_STEP_NAMES = ["Install dependencies", "Lint", "Run tests", "Build", "Deploy"];

export default function pipelineRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireOrg);

  // GET /api/pipelines
  router.get("/", async (req, res) => {
    const runs = await prisma.pipelineRun.findMany({
      where: { orgId: req.orgId },
      include: runInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(runs);
  });

  // GET /api/pipelines/:id
  router.get("/:id", async (req, res) => {
    const run = await prisma.pipelineRun.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: runInclude,
    });
    if (!run) return res.status(404).json({ error: "Pipeline run not found" });
    res.json(run);
  });

  // POST /api/pipelines/simulate  { branch?, willFail? }
  // There's no real CI executor here — this exists so the module is demoable without
  // exposing localhost to GitHub for a real webhook. It fabricates a run + steps and
  // "completes" it immediately.
  router.post("/simulate", requirePermission("PIPELINE_TRIGGER"), async (req, res) => {
    const branch = (req.body.branch || "main").trim();
    const willFail = !!req.body.willFail;
    const failAt = willFail ? Math.floor(Math.random() * DEMO_STEP_NAMES.length) : -1;

    const run = await prisma.pipelineRun.create({
      data: {
        orgId: req.orgId,
        branch,
        commitSha: Math.random().toString(16).slice(2, 9),
        commitMessage: "Manual simulated run",
        trigger: "manual",
        source: "manual",
        status: willFail ? "failed" : "success",
        triggeredById: req.user.id,
        finishedAt: new Date(),
        steps: {
          create: DEMO_STEP_NAMES.map((name, i) => ({
            name,
            position: i,
            status: willFail && i === failAt ? "failed" : willFail && i > failAt ? "pending" : "success",
            log:
              willFail && i === failAt
                ? `Error: step "${name}" exited with code 1`
                : willFail && i > failAt
                ? ""
                : `${name} completed successfully.`,
          })),
        },
      },
      include: runInclude,
    });

    io.to(`org:${req.orgId}`).emit("pipeline:updated", run);
    await logActivity(io, {
      orgId: req.orgId,
      actorId: req.user.id,
      action: "pipeline.simulated",
      resourceType: "pipeline",
      resourceId: run.id,
      summary: `${req.user.name} triggered a ${willFail ? "failing" : "passing"} pipeline run on ${branch}`,
    });
    res.status(201).json(run);
  });

  // POST /api/pipelines/:id/rollback
  // Also simulated: there's nothing real to deploy in this project. Creates a new run
  // record that references the one being rolled back to, so the history is honest about
  // what happened without pretending to control real infrastructure.
  router.post("/:id/rollback", requirePermission("PIPELINE_ROLLBACK"), async (req, res) => {
    const target = await prisma.pipelineRun.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!target) return res.status(404).json({ error: "Pipeline run not found" });

    const run = await prisma.pipelineRun.create({
      data: {
        orgId: req.orgId,
        branch: target.branch,
        commitSha: target.commitSha,
        commitMessage: `Rollback to ${target.commitSha || target.id.slice(0, 7)}`,
        trigger: "rollback",
        source: "manual",
        status: "success",
        triggeredById: req.user.id,
        rolledBackFromId: target.id,
        finishedAt: new Date(),
        steps: { create: [{ name: "Redeploy previous artifact", position: 0, status: "success", log: "Rollback simulated — no real deployment target is configured." }] },
      },
      include: runInclude,
    });

    io.to(`org:${req.orgId}`).emit("pipeline:updated", run);
    await logActivity(io, {
      orgId: req.orgId,
      actorId: req.user.id,
      action: "pipeline.rolled_back",
      resourceType: "pipeline",
      resourceId: run.id,
      summary: `${req.user.name} rolled back ${target.branch} to an earlier run`,
    });
    res.status(201).json(run);
  });

  return router;
}
