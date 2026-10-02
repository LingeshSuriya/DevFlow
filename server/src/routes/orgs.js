import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { can } from "../lib/permissions.js";

const ALL_ROLES = ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER", "VIEWER"];

function slugify(name) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}

const memberShape = (m) => ({
  id: m.user.id,
  name: m.user.name,
  email: m.user.email,
  initials: m.user.initials,
  color: m.user.color,
  role: m.role,
});

export default function orgRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const memberships = await prisma.orgMember.findMany({
      where: { userId: req.user.id },
      include: { org: true },
      orderBy: { joinedAt: "asc" },
    });
    res.json(memberships.map((m) => ({
      id: m.org.id, name: m.org.name, slug: m.org.slug, role: m.role,
      githubRepoFullName: m.org.githubRepoFullName || null,
    })));
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
    if (!req.user.memberships.find((m) => m.orgId === id)) {
      return res.status(403).json({ error: "You are not a member of that organization" });
    }
    const members = await prisma.orgMember.findMany({
      where: { orgId: id },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    });
    res.json(members.map(memberShape));
  });

  router.post("/:id/invite", async (req, res) => {
    const { id } = req.params;
    const { email, role } = req.body;

    const me = req.user.memberships.find((m) => m.orgId === id);
    if (!me || !can(me.role, "INVITE_MEMBERS")) {
      return res.status(403).json({ error: "Only an Owner or Admin can invite members" });
    }
    if (!email) return res.status(400).json({ error: "email required" });

    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) return res.status(404).json({ error: "No account with that email yet — they need to sign up first" });

    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: id, userId: target.id } } });
    if (existing) return res.status(409).json({ error: "Already a member of this organization" });

    // Admins can't mint other Admins/Owners — only an Owner can grant those.
    const grantable = me.role === "OWNER" ? ["ADMIN", "DEVELOPER", "TESTER", "PENTESTER", "VIEWER"] : ["DEVELOPER", "TESTER", "PENTESTER", "VIEWER"];
    const assignRole = grantable.includes(role) ? role : "DEVELOPER";

    const member = await prisma.orgMember.create({
      data: { orgId: id, userId: target.id, role: assignRole },
      include: { user: true },
    });
    io.to(`org:${id}`).emit("org:members_changed", { orgId: id });
    res.status(201).json(memberShape(member));
  });

  // Change a member's role — Owner only. An org must always keep at least one Owner.
  router.patch("/:id/members/:userId", async (req, res) => {
    const { id, userId } = req.params;
    const { role } = req.body;

    const me = req.user.memberships.find((m) => m.orgId === id);
    if (!me || !can(me.role, "MANAGE_MEMBERS")) return res.status(403).json({ error: "Only an Owner can change roles" });
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ error: "invalid role" });

    const target = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: id, userId } } });
    if (!target) return res.status(404).json({ error: "Member not found" });

    if (target.role === "OWNER" && role !== "OWNER") {
      const owners = await prisma.orgMember.count({ where: { orgId: id, role: "OWNER" } });
      if (owners <= 1) return res.status(400).json({ error: "An organization must keep at least one Owner." });
    }

    const member = await prisma.orgMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: true },
    });
    io.to(`org:${id}`).emit("org:members_changed", { orgId: id });
    res.json(memberShape(member));
  });

  // Remove a member — Owner only. Their tasks/bugs in this org become unassigned.
  router.delete("/:id/members/:userId", async (req, res) => {
    const { id, userId } = req.params;

    const me = req.user.memberships.find((m) => m.orgId === id);
    if (!me || !can(me.role, "MANAGE_MEMBERS")) return res.status(403).json({ error: "Only an Owner can remove members" });

    const target = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: id, userId } } });
    if (!target) return res.status(404).json({ error: "Member not found" });

    if (target.role === "OWNER") {
      const owners = await prisma.orgMember.count({ where: { orgId: id, role: "OWNER" } });
      if (owners <= 1) return res.status(400).json({ error: "An organization must keep at least one Owner." });
    }

    await prisma.$transaction([
      prisma.task.updateMany({ where: { orgId: id, assigneeId: userId }, data: { assigneeId: null } }),
      prisma.bug.updateMany({ where: { orgId: id, assigneeId: userId }, data: { assigneeId: null } }),
      prisma.orgMember.delete({ where: { id: target.id } }),
    ]);

    // Tell everyone, then drop the removed user's live connections so they stop receiving
    // this org's chat/board events. Their client reconnects and can only re-join rooms
    // they're still a member of (join handlers re-check membership).
    io.to(`org:${id}`).emit("org:members_changed", { orgId: id });
    const sockets = await io.fetchSockets();
    sockets.filter((s) => s.data.userId === userId).forEach((s) => s.disconnect(true));

    res.json({ ok: true });
  });

  // PATCH /api/orgs/:id — settings like the connected GitHub repo. Owner only.
  router.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { githubRepoFullName } = req.body;

    const me = req.user.memberships.find((m) => m.orgId === id);
    if (!me || !can(me.role, "MANAGE_ORG_SETTINGS")) return res.status(403).json({ error: "Only an Owner can change organization settings" });

    if (githubRepoFullName !== undefined) {
      if (githubRepoFullName && !/^[\w.-]+\/[\w.-]+$/.test(githubRepoFullName)) {
        return res.status(400).json({ error: 'Expected "owner/repo" format' });
      }
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { githubRepoFullName: githubRepoFullName === "" ? null : githubRepoFullName },
    });
    res.json({ id: org.id, name: org.name, slug: org.slug, role: me.role, githubRepoFullName: org.githubRepoFullName });
  });

  return router;
}
