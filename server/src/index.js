import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { verifyToken } from "./lib/auth.js";
import { prisma } from "./db.js";
import authRoutes from "./routes/auth.js";
import orgRoutes from "./routes/orgs.js";
import userRoutes from "./routes/users.js";
import taskRoutesFactory from "./routes/tasks.js";
import channelRoutesFactory from "./routes/channels.js";
import bugRoutesFactory from "./routes/bugs.js";
import reviewRoutesFactory from "./routes/reviews.js";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing auth token"));
  try {
    const payload = verifyToken(token);
    socket.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  // Board + bug tracker updates are broadcast per-org.
  socket.on("org:join", async (orgId) => {
    const isMember = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: socket.userId } } });
    if (isMember) socket.join(`org:${orgId}`);
  });
  socket.on("org:leave", (orgId) => socket.leave(`org:${orgId}`));

  // Chat messages are broadcast per-channel.
  socket.on("channel:join", async (channelId) => {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return;
    const isMember = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: channel.orgId, userId: socket.userId } } });
    if (isMember) socket.join(`channel:${channelId}`);
  });
  socket.on("channel:leave", (channelId) => socket.leave(`channel:${channelId}`));

  // Code review comments are broadcast per-PR.
  socket.on("review:join", async (reviewId) => {
    const review = await prisma.pullRequest.findUnique({ where: { id: reviewId } });
    if (!review) return;
    const isMember = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: review.orgId, userId: socket.userId } } });
    if (isMember) socket.join(`review:${reviewId}`);
  });
  socket.on("review:leave", (reviewId) => socket.leave(`review:${reviewId}`));
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutesFactory(io));
app.use("/api/channels", channelRoutesFactory(io));
app.use("/api/bugs", bugRoutesFactory(io));
app.use("/api/reviews", reviewRoutesFactory(io));

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`DevFlow API listening on :${PORT}`);
});
