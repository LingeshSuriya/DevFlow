import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

const STATUSES = ["open", "approved", "changes_requested", "merged"];

// Accepts a normal github.com PR URL and returns {owner, repo, number} or null.
function parseGithubPrUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean); // [owner, repo, "pull", number]
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

  // GET /api/reviews
  router.get("/", async (req, res) => {
    const reviews = await prisma.pullRequest.findMany({
      where: { orgId: req.orgId },
      include: { author: true, _count: { select: { comments: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  });

  // GET /api/reviews/:id — includes diff + comments
  router.get("/:id", async (req, res) => {
    const review = await prisma.pullRequest.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: { author: true, comments: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  });

  // POST /api/reviews  { sourceUrl, title? }
  // Fetches the unified diff from GitHub's public .diff endpoint — works for any public
  // PR without a token. Private repos would need a GITHUB_TOKEN, not implemented here.
  router.post("/", async (req, res) => {
    const { sourceUrl, title } = req.body;
    if (!sourceUrl) return res.status(400).json({ error: "sourceUrl required" });

    const parsed = parseGithubPrUrl(sourceUrl);
    if (!parsed) {
      return res.status(400).json({ error: "That doesn't look like a github.com PR URL, e.g. https://github.com/owner/repo/pull/123" });
    }

    let diffText;
    try {
      const diffRes = await fetch(`${sourceUrl.replace(/\/$/, "")}.diff`);
      if (!diffRes.ok) {
        throw new Error(diffRes.status === 404 ? "PR not found (private repo or wrong URL?)" : `GitHub returned ${diffRes.status}`);
      }
      diffText = await diffRes.text();
    } catch (e) {
      return res.status(502).json({ error: `Couldn't fetch the diff: ${e.message}` });
    }

    const review = await prisma.pullRequest.create({
      data: {
        orgId: req.orgId,
        title: title?.trim() || `${parsed.owner}/${parsed.repo} #${parsed.number}`,
        sourceUrl,
        diffText,
        authorId: req.user.id,
      },
      include: { author: true },
    });

    io.to(`org:${req.orgId}`).emit("review:created", review);
    res.status(201).json(review);
  });

  // PATCH /api/reviews/:id  { status }  — the review decision
  router.patch("/:id", async (req, res) => {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "invalid status" });

    const existing = await prisma.pullRequest.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!existing) return res.status(404).json({ error: "Review not found" });

    const review = await prisma.pullRequest.update({
      where: { id: req.params.id },
      data: { status },
      include: { author: true },
    });

    io.to(`org:${req.orgId}`).emit("review:updated", review);
    io.to(`review:${review.id}`).emit("review:updated", review);
    res.json(review);
  });

  // POST /api/reviews/:id/comments  { text, fileName?, lineLabel?, isDecision? }
  router.post("/:id/comments", async (req, res) => {
    const { text, fileName, lineLabel, isDecision } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

    const review = await prisma.pullRequest.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!review) return res.status(404).json({ error: "Review not found" });

    const comment = await prisma.reviewComment.create({
      data: {
        prId: review.id,
        userId: req.user.id,
        text: text.trim(),
        fileName: fileName || "",
        lineLabel: lineLabel || "",
        isDecision: !!isDecision,
      },
      include: { user: true },
    });

    io.to(`review:${review.id}`).emit("review:comment", { prId: review.id, comment });
    res.status(201).json(comment);
  });

  return router;
}
