import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { verifyToken } from "./lib/auth.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import taskRoutesFactory from "./routes/tasks.js";
import channelRoutesFactory from "./routes/channels.js";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Reject socket connections without a valid JWT so live updates match the API's auth.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing auth token"));
  try {
    verifyToken(token);
    next();
  } catch {
    next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  socket.on("channel:join", (channelId) => socket.join(`channel:${channelId}`));
  socket.on("channel:leave", (channelId) => socket.leave(`channel:${channelId}`));
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutesFactory(io));
app.use("/api/channels", channelRoutesFactory(io));

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`DevFlow API listening on :${PORT}`);
});
