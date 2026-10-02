import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";

const router = Router();
router.use(requireAuth, requireOrg);

router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const entries = await prisma.activityLog.findMany({ where: { orgId: req.orgId }, orderBy: { createdAt: "desc" }, take: limit });
  res.json(entries);
});

export default router;
