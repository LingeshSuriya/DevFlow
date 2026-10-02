// Layer 1 of authorization: ROLE-based. "Is this kind of action allowed for your role at all?"
// Layer 2 (per-resource rules, e.g. "only the assignee may move this task") lives in
// lib/taskAccess.js. Frontend mirrors both for UI hints only — this file is the real gate.
export const PERMISSIONS = {
  CREATE_TASKS: ["OWNER", "ADMIN", "DEVELOPER"],
  BUG_WRITE: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  IMPORT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  COMMENT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  DECIDE_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  SEND_CHAT: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  INVITE_MEMBERS: ["OWNER", "ADMIN"],
  MANAGE_MEMBERS: ["OWNER"], // change roles / remove members
  PIPELINE_TRIGGER: ["OWNER", "ADMIN", "DEVELOPER"], // manual "simulate run"
  PIPELINE_ROLLBACK: ["OWNER", "ADMIN"],
  MANAGE_ORG_SETTINGS: ["OWNER"], // connect a GitHub repo, etc.
};

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}
