import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export default function channelRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  // GET /api/channels
  router.get("/", async (req, res) => {
    const channels = await prisma.channel.findMany({ orderBy: { name: "asc" } });
    res.json(channels);
  });

  // GET /api/channels/:id/messages
  router.get("/:id/messages", async (req, res) => {
    const { id } = req.params;
    const messages = await prisma.message.findMany({
      where: { channelId: id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json(messages);
  });

  // POST /api/channels/:id/messages  { text }  -- sender is the authenticated user
  router.post("/:id/messages", async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

    const message = await prisma.message.create({
      data: { text: text.trim(), channelId: id, userId: req.user.id },
      include: { user: true },
    });

    io.to(`channel:${id}`).emit("message:new", message);
    res.status(201).json(message);
  });

  return router;
}
