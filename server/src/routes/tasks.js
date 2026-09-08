import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

function withRole(task) {
  if (!task.assignee) return task;
  const role = task.assignee.memberships?.[0]?.role || null;
  return { ...task, assignee: { ...task.assignee, role, memberships: undefined } };
}

export default function taskRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireOrg);

  const assigneeInclude = { assignee: { include: { memberships: true } } };

  router.get("/", async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: { orgId: req.orgId },
      include: assigneeInclude,
      orderBy: { createdAt: "asc" },
    });
    res.json(tasks.map(withRole));
  });

  router.get("/:id", async (req, res) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: assigneeInclude,
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(withRole(task));
  });

  router.post("/", async (req, res) => {
    const { title, assigneeId, points, description } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title required" });

    if (assigneeId) {
      const assigneeIsMember = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: req.orgId, userId: assigneeId } },
      });
      if (!assigneeIsMember) return res.status(400).json({ error: "Assignee is not a member of this organization" });
    }

    const task = await prisma.task.create({
      data: { orgId: req.orgId, title: title.trim(), assigneeId: assigneeId || null, points: points || 1, description: description || "" },
      include: assigneeInclude,
    });

    const payload = withRole(task);
    io.to(`org:${req.orgId}`).emit("task:created", payload);
    res.status(201).json(payload);
  });

  router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { status, assigneeId, description, title } = req.body;

    const existing = await prisma.task.findFirst({ where: { id, orgId: req.orgId } });
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const data = {};
    if (status !== undefined) {
      const valid = ["todo", "in_progress", "review", "done"];
      if (!valid.includes(status)) return res.status(400).json({ error: "invalid status" });
      data.status = status;
    }
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (description !== undefined) data.description = description;
    if (title !== undefined && title.trim()) data.title = title.trim();

    const task = await prisma.task.update({ where: { id }, data, include: assigneeInclude });

    const payload = withRole(task);
    io.to(`org:${req.orgId}`).emit("task:moved", payload);
    res.json(payload);
  });

  return router;
}
