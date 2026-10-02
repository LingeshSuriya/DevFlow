import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

const router = Router();
router.use(requireAuth, requireOrg);

router.get("/", async (req, res) => {
  const members = await prisma.orgMember.findMany({ where: { orgId: req.orgId }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  res.json(members.map((m) => ({ id: m.user.id, name: m.user.name, initials: m.user.initials, color: m.user.color, role: m.role })));
});

export default router;
