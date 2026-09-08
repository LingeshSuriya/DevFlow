export const SEVERITIES = {
  critical: { label: "Critical", badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "High", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  medium: { label: "Medium", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  low: { label: "Low", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export const BUG_STATUSES = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "fixed", label: "Fixed" },
  { key: "closed", label: "Closed" },
];

export function severityMeta(s) {
  return SEVERITIES[s] || SEVERITIES.medium;
}

export function bugStatusLabel(s) {
  return BUG_STATUSES.find((b) => b.key === s)?.label || s;
}
