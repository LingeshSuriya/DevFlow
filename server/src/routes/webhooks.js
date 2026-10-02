import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db.js";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

function verifySignature(req) {
  if (!WEBHOOK_SECRET) return true; // dev convenience — signature check skipped if no secret set
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !req.rawBody) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(req.rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function statusFrom(action, conclusion) {
  if (action === "completed") return conclusion === "success" ? "success" : "failed";
  if (action === "in_progress") return "running";
  return "queued";
}

export default function webhookRoutes(io) {
  const router = Router();

  // POST /api/webhooks/github — no auth, GitHub calls this directly.
  router.post("/github", async (req, res) => {
    if (!verifySignature(req)) return res.status(401).send("Invalid signature");

    const event = req.headers["x-github-event"];
    if (event !== "workflow_run") return res.status(204).end(); // ignore other event types we don't model

    const { action, workflow_run: wr, repository } = req.body;
    if (!wr || !repository) return res.status(400).send("Malformed payload");

    const org = await prisma.organization.findFirst({ where: { githubRepoFullName: repository.full_name } });
    if (!org) return res.status(404).send("No org connected to this repository");

    const run = await prisma.pipelineRun.upsert({
      where: { externalId: String(wr.id) },
      update: {
        status: statusFrom(action, wr.conclusion),
        finishedAt: action === "completed" ? new Date() : null,
      },
      create: {
        orgId: org.id,
        externalId: String(wr.id),
        branch: wr.head_branch || "unknown",
        commitSha: (wr.head_sha || "").slice(0, 7),
        commitMessage: wr.head_commit?.message?.split("\n")[0] || "",
        trigger: wr.event === "pull_request" ? "pull_request" : "push",
        source: "webhook",
        status: statusFrom(action, wr.conclusion),
      },
      include: { triggeredBy: true, steps: { orderBy: { position: "asc" } } },
    });

    io.to(`org:${org.id}`).emit("pipeline:updated", run);
    res.status(200).send("ok");
  });

  return router;
}
