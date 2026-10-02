// Mirrors server/src/lib/permissions.js — UI hints only. The backend re-checks everything.
export const PERMISSIONS = {
  CREATE_TASKS: ["OWNER", "ADMIN", "DEVELOPER"],
  BUG_WRITE: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  IMPORT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  COMMENT_REVIEW: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  DECIDE_REVIEW: ["OWNER", "ADMIN", "DEVELOPER"],
  SEND_CHAT: ["OWNER", "ADMIN", "DEVELOPER", "TESTER", "PENTESTER"],
  INVITE_MEMBERS: ["OWNER", "ADMIN"],
  MANAGE_MEMBERS: ["OWNER"],
  PIPELINE_TRIGGER: ["OWNER", "ADMIN", "DEVELOPER"],
  PIPELINE_ROLLBACK: ["OWNER", "ADMIN"],
  MANAGE_ORG_SETTINGS: ["OWNER"],
};

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}
