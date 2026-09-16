// Single source of truth for who can do what. Mirrored on the frontend
// (src/data/permissions.js) for UI hints — but the backend check here is the
// actual gate. Never trust the frontend's copy.
export const PERMISSIONS = {
  MANAGE_TASKS: ["OWNER", "ADMIN", "DEVELOPER"],           // create/edit/move/delete tasks
  BUG_WRITE: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"], // report/update/comment bugs
  IMPORT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],           // import a PR for review
  COMMENT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  DECIDE_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],           // approve / request changes / merge
  SEND_CHAT: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  INVITE_MEMBERS: ["OWNER", "ADMIN"],
};

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}
