// Layer 2 authorization for tasks: RESOURCE-level rules. Given who you are, your role,
// and the specific task, is THIS change allowed?
//
//  Owner / Admin : anything, on any task.
//  Developer     : edit/move only tasks assigned to them. May claim an unassigned task
//                  (assign to self) or release their own. Cannot reassign to/from others.
//  Tester / Pentester : QA gate only — may move a task that is in Review to Done
//                  (pass) or In Progress (send back). Nothing else.
//  Viewer        : read-only.
const ADMINS = ["OWNER", "ADMIN"];

export function checkTaskUpdate({ role, userId, existing, changes }) {
  const has = (k) => changes[k] !== undefined;

  const nextAssignee = has("assigneeId") ? changes.assigneeId || null : existing.assigneeId;
  const assigneeChanging = nextAssignee !== existing.assigneeId;
  const statusChanging = has("status") && changes.status !== existing.status;
  const contentChanging =
    (has("title") && String(changes.title).trim() !== existing.title) ||
    (has("description") && changes.description !== existing.description) ||
    (has("points") && changes.points !== existing.points);

  if (ADMINS.includes(role)) return { ok: true };

  if (role === "DEVELOPER") {
    const isAssignee = existing.assigneeId === userId;
    const claiming = assigneeChanging && existing.assigneeId === null && nextAssignee === userId;
    const releasing = assigneeChanging && isAssignee && nextAssignee === null;

    if (assigneeChanging && !claiming && !releasing) {
      return { ok: false, error: "Only an Owner or Admin can reassign a task to or from someone else." };
    }
    if ((statusChanging || contentChanging) && !(isAssignee || claiming)) {
      return { ok: false, error: "You can only edit or move tasks assigned to you. Claim it first." };
    }
    return { ok: true };
  }

  if (role === "TESTER" || role === "PENTESTER") {
    if (assigneeChanging || contentChanging) {
      return { ok: false, error: "Your role can't edit or reassign tasks." };
    }
    if (statusChanging) {
      if (existing.status !== "review") {
        return { ok: false, error: "Testers and Pentesters can only move tasks that are in Review." };
      }
      if (!["done", "in_progress"].includes(changes.status)) {
        return { ok: false, error: "From Review you can pass a task (Done) or send it back (In Progress)." };
      }
    }
    return { ok: true };
  }

  return { ok: false, error: "Your role has read-only access to tasks." };
}
