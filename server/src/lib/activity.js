import { prisma } from "../db.js";

export async function logActivity(io, { orgId, actorId, action, resourceType, resourceId, summary }) {
  const entry = await prisma.activityLog.create({
    data: { orgId, actorId, action, resourceType, resourceId: resourceId || null, summary },
  });
  if (io) io.to(`org:${orgId}`).emit("activity:new", entry);
  return entry;
}
