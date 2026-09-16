// Mirrors server/src/lib/permissions.js. This copy only controls what buttons/inputs
// are shown — the backend re-checks every write independently and is the real gate.
export const PERMISSIONS = {
  MANAGE_TASKS: ["OWNER", "ADMIN", "DEVELOPER"],
  BUG_WRITE: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  IMPORT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  COMMENT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  DECIDE_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  SEND_CHAT: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  INVITE_MEMBERS: ["OWNER", "ADMIN"],
};

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}
