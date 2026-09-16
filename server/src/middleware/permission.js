import { can } from "../lib/permissions.js";

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!can(req.role, permission)) {
      return res.status(403).json({ error: `Your role (${req.role}) doesn't have permission to do this.` });
    }
    next();
  };
}
