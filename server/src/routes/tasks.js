import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

function withRole(task) {
  if (!task.assignee) return task;
  const role = task.assignee.memberships?.[0]?.role || null;
  return { ...task, assignee: { ...task.assignee, role, memberships: undefined } };
}

export default function taskRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  const assigneeInclude = { assignee: { include: { memberships: true } } };

  // GET /api/tasks
  router.get("/", async (req, res) => {
    const tasks = await prisma.task.findMany({
      include: assigneeInclude,
      orderBy: { createdAt: "asc" },
    });
    res.json(tasks.map(withRole));
  });

  // GET /api/tasks/:id
  router.get("/:id", async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: assigneeInclude,
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(withRole(task));
  });

  // POST /api/tasks  { title, assigneeId?, points?, description? }
  router.post("/", async (req, res) => {
    const { title, assigneeId, points, description } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "title required" });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        assigneeId: assigneeId || null,
        points: points || 1,
        description: description || "",
      },
      include: assigneeInclude,
    });

    const payload = withRole(task);
    io.emit("task:created", payload);
    res.status(201).json(payload);
  });

  // PATCH /api/tasks/:id  { status?, assigneeId?, description?, title? }
  router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { status, assigneeId, description, title } = req.body;

    const data = {};
    if (status !== undefined) {
      const valid = ["todo", "in_progress", "review", "done"];
      if (!valid.includes(status)) return res.status(400).json({ error: "invalid status" });
      data.status = status;
    }
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (description !== undefined) data.description = description;
    if (title !== undefined && title.trim()) data.title = title.trim();

    const task = await prisma.task.update({
      where: { id },
      data,
      include: assigneeInclude,
    });

    const payload = withRole(task);
    io.emit("task:moved", payload);
    res.json(payload);
  });

  return router;
}
