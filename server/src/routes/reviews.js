import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";
import { requirePermission } from "../middleware/permission.js";
import { logActivity } from "../lib/activity.js";

const STATUSES = ["open", "approved", "changes_requested", "merged"];
const STATUS_LABEL = { open: "Open", approved: "Approved", changes_requested: "Changes requested", merged: "Merged" };

function parseGithubPrUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 4 || parts[2] !== "pull") return null;
    const number = parseInt(parts[3], 10);
    if (!Number.isFinite(number)) return null;
    return { owner: parts[0], repo: parts[1], number };
  } catch {
    return null;
  }
}

export default function reviewRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireOrg);

  router.get("/", async (req, res) => {
    const reviews = await prisma.pullRequest.findMany({
      where: { orgId: req.orgId }, include: { author: true, _count: { select: { comments: true } } }, orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  });

  router.get("/:id", async (req, res) => {
    const review = await prisma.pullRequest.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: { author: true, comments: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  });

  router.post("/", requirePermission("IMPORT_REVIEW"), async (req, res) => {
    const { sourceUrl, title } = req.body;
    if (!sourceUrl) return res.status(400).json({ error: "sourceUrl required" });

    const parsed = parseGithubPrUrl(sourceUrl);
    if (!parsed) return res.status(400).json({ error: "That doesn't look like a github.com PR URL, e.g. https://github.com/owner/repo/pull/123" });

    let diffText;
    try {
      const diffRes = await fetch(`${sourceUrl.replace(/\/$/, "")}.diff`);
      if (!diffRes.ok) throw new Error(diffRes.status === 404 ? "PR not found (private repo or wrong URL?)" : `GitHub returned ${diffRes.status}`);
      diffText = await diffRes.text();
    } catch (e) {
      return res.status(502).json({ error: `Couldn't fetch the diff: ${e.message}` });
    }

    const review = await prisma.pullRequest.create({
      data: { orgId: req.orgId, title: title?.trim() || `${parsed.owner}/${parsed.repo} #${parsed.number}`, sourceUrl, diffText, authorId: req.user.id },
      include: { author: true },
    });

    io.to(`org:${req.orgId}`).emit("review:created", review);
    await logActivity(io, {
      orgId: req.orgId, actorId: req.user.id, action: "review.imported",
      resourceType: "review", resourceId: review.id, summary: `${req.user.name} imported PR "${review.title}" for review`,
    });
    res.status(201).json(review);
  });

  router.patch("/:id", requirePermission("DECIDE_REVIEW"), async (req, res) => {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "invalid status" });

    const existing = await prisma.pullRequest.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!existing) return res.status(404).json({ error: "Review not found" });

    const review = await prisma.pullRequest.update({ where: { id: req.params.id }, data: { status }, include: { author: true } });
    io.to(`org:${req.orgId}`).emit("review:updated", review);
    io.to(`review:${review.id}`).emit("review:updated", review);
    await logActivity(io, {
      orgId: req.orgId, actorId: req.user.id, action: "review.decided",
      resourceType: "review", resourceId: review.id, summary: `${req.user.name} marked "${review.title}" as ${STATUS_LABEL[status]}`,
    });
    res.json(review);
  });

  router.post("/:id/comments", requirePermission("COMMENT_REVIEW"), async (req, res) => {
    const { text, fileName, lineLabel, isDecision } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

    const review = await prisma.pullRequest.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!review) return res.status(404).json({ error: "Review not found" });

    const comment = await prisma.reviewComment.create({
      data: { prId: review.id, userId: req.user.id, text: text.trim(), fileName: fileName || "", lineLabel: lineLabel || "", isDecision: !!isDecision },
      include: { user: true },
    });

    io.to(`review:${review.id}`).emit("review:comment", { prId: review.id, comment });
    res.status(201).json(comment);
  });

  return router;
}
