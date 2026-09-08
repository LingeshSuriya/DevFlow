import { verifyToken } from "../lib/auth.js";
import { prisma } from "../db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { memberships: { include: { org: true } } },
    });
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    req.membership = user.memberships[0] || null;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
