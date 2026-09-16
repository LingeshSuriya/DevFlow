import { prisma } from "../db.js";

// io is optional — pass it to also push the entry live to anyone watching the org's Dashboard.
export async function logActivity(io, { orgId, actorId, action, resourceType, resourceId, summary }) {
  const entry = await prisma.activityLog.create({
    data: { orgId, actorId, action, resourceType, resourceId: resourceId || null, summary },
  });
  if (io) io.to(`org:${orgId}`).emit("activity:new", entry);
  return entry;
}
