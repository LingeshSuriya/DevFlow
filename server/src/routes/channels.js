import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

export default function channelRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireOrg);

  router.get("/", async (req, res) => {
    const channels = await prisma.channel.findMany({ where: { orgId: req.orgId }, orderBy: { name: "asc" } });
    res.json(channels);
  });

  router.get("/:id/messages", async (req, res) => {
    const channel = await prisma.channel.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const messages = await prisma.message.findMany({
      where: { channelId: channel.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json(messages);
  });

  router.post("/:id/messages", async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

    const channel = await prisma.channel.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    const message = await prisma.message.create({
      data: { text: text.trim(), channelId: channel.id, userId: req.user.id },
      include: { user: true },
    });

    io.to(`channel:${channel.id}`).emit("message:new", message);
    res.status(201).json(message);
  });

  return router;
}
