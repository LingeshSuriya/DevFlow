// Mirrors server/src/lib/taskAccess.js — decides which controls to show for one task.
// The backend is the real gate; if these ever disagree, the backend wins (403).
const STATUSES = ["todo", "in_progress", "review", "done"];

export function getTaskCaps(role, userId, task) {
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const isAssignee = !!task.assigneeId && task.assigneeId === userId;
  const unassigned = !task.assigneeId;
  const others = STATUSES.filter((s) => s !== task.status);

  if (isAdmin) {
    return { canEdit: true, canReassign: true, canClaim: unassigned, canRelease: false, moveTargets: others, hint: "" };
  }

  if (role === "DEVELOPER") {
    return {
      canEdit: isAssignee,
      canReassign: false,
      canClaim: unassigned,
      canRelease: isAssignee,
      moveTargets: isAssignee ? others : [],
      hint: isAssignee
        ? ""
        : unassigned
        ? "Nobody owns this task yet — claim it to edit or move it."
        : "Assigned to someone else — read-only for you.",
    };
  }

  if (role === "TESTER" || role === "PENTESTER") {
    const inReview = task.status === "review";
    return {
      canEdit: false,
      canReassign: false,
      canClaim: false,
      canRelease: false,
      moveTargets: inReview ? ["in_progress", "done"] : [],
      hint: inReview
        ? "In Review — you can pass it (Done) or send it back (In Progress)."
        : "Testers and Pentesters can only act on tasks that are in Review.",
    };
  }

  return { canEdit: false, canReassign: false, canClaim: false, canRelease: false, moveTargets: [], hint: "Viewers have read-only access." };
}
