import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/users  -> members of the current user's org, with role attached
router.get("/", async (req, res) => {
  if (!req.membership) return res.json([]);

  const members = await prisma.orgMember.findMany({
    where: { orgId: req.membership.orgId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  res.json(
    members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      initials: m.user.initials,
      color: m.user.color,
      role: m.role,
    }))
  );
});

export default router;
