import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

const SEVERITIES = ["critical", "high", "medium", "low"];
const STATUSES = ["open", "in_progress", "fixed", "closed"];

const peopleInclude = { reporter: true, assignee: true, linkedTask: true };

export default function bugRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireOrg);

  // GET /api/bugs  — supports ?status= and ?severity= filters
  router.get("/", async (req, res) => {
    const { status, severity } = req.query;
    const where = { orgId: req.orgId };
    if (status && STATUSES.includes(status)) where.status = status;
    if (severity && SEVERITIES.includes(severity)) where.severity = severity;

    const bugs = await prisma.bug.findMany({
      where,
      include: peopleInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(bugs);
  });

  // GET /api/bugs/:id  — includes comments
  router.get("/:id", async (req, res) => {
    const bug = await prisma.bug.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: { ...peopleInclude, comments: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!bug) return res.status(404).json({ error: "Bug not found" });
    res.json(bug);
  });

  // POST /api/bugs  { title, description?, stepsToReproduce?, severity?, assigneeId?, linkedTaskId? }
  router.post("/", async (req, res) => {
    const { title, description, stepsToReproduce, severity, assigneeId, linkedTaskId } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title required" });

    const bug = await prisma.bug.create({
      data: {
        orgId: req.orgId,
        title: title.trim(),
        description: description || "",
        stepsToReproduce: stepsToReproduce || "",
        severity: SEVERITIES.includes(severity) ? severity : "medium",
        reporterId: req.user.id,
        assigneeId: assigneeId || null,
        linkedTaskId: linkedTaskId || null,
      },
      include: peopleInclude,
    });

    io.to(`org:${req.orgId}`).emit("bug:created", bug);
    res.status(201).json(bug);
  });

  // PATCH /api/bugs/:id  { status?, severity?, assigneeId?, linkedTaskId? }
  router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { status, severity, assigneeId, linkedTaskId } = req.body;

    const existing = await prisma.bug.findFirst({ where: { id, orgId: req.orgId } });
    if (!existing) return res.status(404).json({ error: "Bug not found" });

    const data = {};
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "invalid status" });
      data.status = status;
    }
    if (severity !== undefined) {
      if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: "invalid severity" });
      data.severity = severity;
    }
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (linkedTaskId !== undefined) data.linkedTaskId = linkedTaskId || null;

    const bug = await prisma.bug.update({ where: { id }, data, include: peopleInclude });

    io.to(`org:${req.orgId}`).emit("bug:updated", bug);
    res.json(bug);
  });

  // POST /api/bugs/:id/comments  { text }
  router.post("/:id/comments", async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

    const bug = await prisma.bug.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const comment = await prisma.bugComment.create({
      data: { bugId: bug.id, userId: req.user.id, text: text.trim() },
      include: { user: true },
    });

    io.to(`org:${req.orgId}`).emit("bug:comment", { bugId: bug.id, comment });
    res.status(201).json(comment);
  });

  return router;
}
