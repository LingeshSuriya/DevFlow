import { Router } from "express";
import { prisma } from "../db.js";
import {
  signToken,
  hashPassword,
  comparePassword,
  initialsFromName,
  colorFromString,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL || "http://localhost:5000/api/auth/github/callback";

// Every new signup lands in this single default org for the MVP.
async function getOrCreateDefaultOrg() {
  return prisma.organization.upsert({
    where: { slug: "devflow-team" },
    update: {},
    create: { name: "DevFlow Team", slug: "devflow-team" },
  });
}

function toPublicUser(user, role) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    color: user.color,
    role,
  };
}

function userRole(user) {
  return user.memberships?.[0]?.role || null;
}

// POST /api/auth/register  { email, password, name }
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const passwordHash = await hashPassword(password);
  const org = await getOrCreateDefaultOrg();

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      initials: initialsFromName(name),
      color: colorFromString(email),
      memberships: { create: { orgId: org.id, role: "DEVELOPER" } },
    },
    include: { memberships: true },
  });

  const token = signToken({ sub: user.id });
  res.status(201).json({ token, user: toPublicUser(user, userRole(user)) });
});

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken({ sub: user.id });
  res.json({ token, user: toPublicUser(user, userRole(user)) });
});

// GET /api/auth/github  -> redirects to GitHub's OAuth consent screen
router.get("/github", (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).send("GitHub OAuth is not configured (missing GITHUB_CLIENT_ID)");
  }
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "read:user user:email",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /api/auth/github/callback?code=...
router.get("/github/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}/login?error=github_no_code`);

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access_token from GitHub");

    const ghUserRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser = await ghUserRes.json();

    let email = ghUser.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailsRes.json();
      email = emails.find((e) => e.primary)?.email || emails[0]?.email || `${ghUser.id}@users.noreply.github.com`;
    }

    const org = await getOrCreateDefaultOrg();
    const name = ghUser.name || ghUser.login;

    let user = await prisma.user.findUnique({ where: { githubId: String(ghUser.id) } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          initials: initialsFromName(name),
          color: colorFromString(email),
          githubId: String(ghUser.id),
          githubLogin: ghUser.login,
          memberships: { create: { orgId: org.id, role: "DEVELOPER" } },
        },
      });
    }

    const token = signToken({ sub: user.id });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (e) {
    console.error("GitHub OAuth error:", e);
    res.redirect(`${FRONTEND_URL}/login?error=github_failed`);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json(toPublicUser(req.user, userRole(req.user)));
});

export default router;
