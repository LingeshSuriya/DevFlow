// Must run after requireAuth (needs req.user.memberships loaded).
export function requireOrg(req, res, next) {
  const orgId = req.headers["x-org-id"];
  if (!orgId) return res.status(400).json({ error: "Missing X-Org-Id header — no organization selected" });

  const membership = req.user.memberships.find((m) => m.orgId === orgId);
  if (!membership) return res.status(403).json({ error: "You are not a member of that organization" });

  req.orgId = orgId;
  req.role = membership.role;
  next();
}

// Optional role gate, use after requireOrg: requireRole("OWNER", "ADMIN")
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.role)) {
      return res.status(403).json({ error: `Requires one of: ${allowed.join(", ")}` });
    }
    next();
  };
}
