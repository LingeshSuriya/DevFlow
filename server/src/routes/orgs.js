import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function slugify(name) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}

router.get("/", async (req, res) => {
  const memberships = await prisma.orgMember.findMany({
    where: { userId: req.user.id },
    include: { org: true },
    orderBy: { joinedAt: "asc" },
  });
  res.json(memberships.map((m) => ({ id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role })));
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Organization name required" });

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug: slugify(name),
      members: { create: { userId: req.user.id, role: "OWNER" } },
      channels: { create: { name: "general" } },
    },
  });

  res.status(201).json({ id: org.id, name: org.name, slug: org.slug, role: "OWNER" });
});

router.get("/:id/members", async (req, res) => {
  const { id } = req.params;
  const membership = req.user.memberships.find((m) => m.orgId === id);
  if (!membership) return res.status(403).json({ error: "You are not a member of that organization" });

  const members = await prisma.orgMember.findMany({
    where: { orgId: id },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  res.json(members.map((m) => ({
    id: m.user.id, name: m.user.name, email: m.user.email,
    initials: m.user.initials, color: m.user.color, role: m.role,
  })));
});

router.post("/:id/invite", async (req, res) => {
  const { id } = req.params;
  const { email, role } = req.body;

  const membership = req.user.memberships.find((m) => m.orgId === id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return res.status(403).json({ error: "Only an Owner or Admin can invite members" });
  }
  if (!email) return res.status(400).json({ error: "email required" });

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return res.status(404).json({ error: "No account with that email yet — they need to sign up first" });

  const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: id, userId: target.id } } });
  if (existing) return res.status(409).json({ error: "Already a member of this organization" });

  const validRoles = ["ADMIN", "DEVELOPER", "TESTER", "PENTESTER", "VIEWER"];
  const assignRole = validRoles.includes(role) ? role : "DEVELOPER";

  const member = await prisma.orgMember.create({
    data: { orgId: id, userId: target.id, role: assignRole },
    include: { user: true },
  });

  res.status(201).json({
    id: member.user.id, name: member.user.name, email: member.user.email,
    initials: member.user.initials, color: member.user.color, role: member.role,
  });
});

export default router;
