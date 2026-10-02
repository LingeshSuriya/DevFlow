export const ROLES = {
  OWNER: { label: "Owner", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  ADMIN: { label: "Admin", badge: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30" },
  DEVELOPER: { label: "Developer", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  TESTER: { label: "Tester", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  PENTESTER: { label: "Pentester", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  VIEWER: { label: "Viewer", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};
export function roleMeta(role) {
  return ROLES[role] || { label: role || "Unknown", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
}
