import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";
import { requirePermission } from "../middleware/permission.js";
import { checkTaskUpdate } from "../lib/taskAccess.js";
import { logActivity } from "../lib/activity.js";
import { columns as COLUMN_LABELS } from "./columnLabels.js";

const STATUSES = ["todo", "in_progress", "review", "done"];

// Attach the assignee's role IN THIS ORG (a user can have a different role in each org).
function withRole(task, orgId) {
  if (!task.assignee) return task;
  const role = task.assignee.memberships?.find((m) => m.orgId === orgId)?.role || null;
  return { ...task, assignee: { ...task.assignee, role, memberships: undefined } };
}

function validPoints(p) {
  return Number.isInteger(p) && p >= 1 && p <= 21;
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
    res.json(tasks.map((t) => withRole(t, req.orgId)));
  });

  router.get("/:id", async (req, res) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: assigneeInclude,
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(withRole(task, req.orgId));
  });

  // Create: role gate (Owner/Admin/Developer). Creator picks title, description,
  // assignee, points and starting column in one go.
  router.post("/", requirePermission("CREATE_TASKS"), async (req, res) => {
    const { title, assigneeId, description, status } = req.body;
    const points = req.body.points === undefined ? 1 : req.body.points;

    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title required" });
    if (!validPoints(points)) return res.status(400).json({ error: "points must be a whole number from 1 to 21" });
    if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: "invalid status" });

    if (assigneeId) {
      const isMember = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: req.orgId, userId: assigneeId } },
      });
      if (!isMember) return res.status(400).json({ error: "Assignee is not a member of this organization" });
    }

    const task = await prisma.task.create({
      data: {
        orgId: req.orgId,
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        assigneeId: assigneeId || null,
        points,
        status: status || "todo",
      },
      include: assigneeInclude,
    });

    const payload = withRole(task, req.orgId);
    io.to(`org:${req.orgId}`).emit("task:created", payload);
    await logActivity(io, {
      orgId: req.orgId,
      actorId: req.user.id,
      action: "task.created",
      resourceType: "task",
      resourceId: task.id,
      summary: `${req.user.name} created task "${task.title}"`,
    });
    res.status(201).json(payload);
  });

  // Update: no blanket role gate — checkTaskUpdate decides per task and per field.
  router.patch("/:id", async (req, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: assigneeInclude,
    });
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const { status, assigneeId, description, title, points } = req.body;

    if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: "invalid status" });
    if (title !== undefined && (typeof title !== "string" || !title.trim())) return res.status(400).json({ error: "title can't be empty" });
    if (description !== undefined && typeof description !== "string") return res.status(400).json({ error: "invalid description" });
    if (points !== undefined && !validPoints(points)) return res.status(400).json({ error: "points must be a whole number from 1 to 21" });

    const verdict = checkTaskUpdate({
      role: req.role,
      userId: req.user.id,
      existing,
      changes: { status, assigneeId, description, title, points },
    });
    if (!verdict.ok) return res.status(403).json({ error: verdict.error });

    if (assigneeId) {
      const isMember = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: req.orgId, userId: assigneeId } },
      });
      if (!isMember) return res.status(400).json({ error: "Assignee is not a member of this organization" });
    }

    // Only write fields that actually changed.
    const data = {};
    if (status !== undefined && status !== existing.status) data.status = status;
    if (assigneeId !== undefined && (assigneeId || null) !== existing.assigneeId) data.assigneeId = assigneeId || null;
    if (description !== undefined && description !== existing.description) data.description = description;
    if (title !== undefined && title.trim() !== existing.title) data.title = title.trim();
    if (points !== undefined && points !== existing.points) data.points = points;

    if (Object.keys(data).length === 0) return res.json(withRole(existing, req.orgId));

    const task = await prisma.task.update({ where: { id: existing.id }, data, include: assigneeInclude });
    const payload = withRole(task, req.orgId);
    io.to(`org:${req.orgId}`).emit("task:moved", payload);

    const log = (action, summary) =>
      logActivity(io, { orgId: req.orgId, actorId: req.user.id, action, resourceType: "task", resourceId: task.id, summary });

    if (data.status) {
      await log("task.moved", `${req.user.name} moved "${task.title}" to ${COLUMN_LABELS[data.status]}`);
    }
    if ("assigneeId" in data) {
      if (data.assigneeId === req.user.id) await log("task.claimed", `${req.user.name} claimed "${task.title}"`);
      else if (data.assigneeId === null) await log("task.released", `${req.user.name} unassigned "${task.title}"`);
      else await log("task.assigned", `${req.user.name} assigned "${task.title}" to ${task.assignee.name}`);
    }
    if (data.title || "description" in data || data.points) {
      await log("task.updated", `${req.user.name} edited task "${task.title}"`);
    }

    res.json(payload);
  });

  return router;
}
