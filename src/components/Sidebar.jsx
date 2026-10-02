import { useState } from "react";
import { LayoutGrid, Columns3, MessageSquare, LogOut, ChevronsUpDown, Check, Building2, Bug, GitPullRequest, Activity } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";
import { roleMeta } from "../data/roles";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/board", label: "Board", icon: Columns3 },
  { to: "/bugs", label: "Bugs", icon: Bug },
  { to: "/reviews", label: "Reviews", icon: GitPullRequest },
  { to: "/pipelines", label: "Pipelines", icon: Activity },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/org", label: "Organization", icon: Building2 },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { orgs, activeOrg, switchOrg } = useOrg();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const role = roleMeta(activeOrg?.role);

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
      <div className="px-4 h-14 flex items-center border-b border-zinc-800">
        <span className="font-mono text-sm tracking-tight text-emerald-400">devflow</span>
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="relative px-2 pt-3">
        <button onClick={() => setSwitcherOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-left">
          <span className="text-sm text-zinc-200 truncate">{activeOrg?.name || "Select org"}</span>
          <ChevronsUpDown size={13} className="text-zinc-600 shrink-0" />
        </button>

        {switcherOpen && (
          <div className="absolute left-2 right-2 mt-1 z-20 border border-zinc-800 bg-zinc-900 rounded-md shadow-xl overflow-hidden">
            {orgs.map((o) => (
              <button key={o.id} onClick={() => { switchOrg(o.id); setSwitcherOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                <span className="truncate">{o.name}</span>
                {o.id === activeOrg?.id && <Check size={13} className="text-emerald-400 shrink-0" />}
              </button>
            ))}
            <NavLink to="/org" onClick={() => setSwitcherOpen(false)} className="block px-2.5 py-2 text-xs text-emerald-400 hover:bg-zinc-800 border-t border-zinc-800">
              + New organization
            </NavLink>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}>
              <Icon size={16} strokeWidth={2} />
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full ${user?.color || "bg-zinc-600"} flex items-center justify-center text-[11px] font-mono text-zinc-950 shrink-0`}>
            {user?.initials || "?"}
          </div>
          <div className="text-xs min-w-0 flex-1">
            <div className="text-zinc-200 leading-tight truncate">{user?.name}</div>
            {activeOrg && <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border ${role.badge}`}>{role.label}</span>}
          </div>
          <button onClick={logout} title="Log out" className="text-zinc-600 hover:text-zinc-300 shrink-0"><LogOut size={14} /></button>
        </div>
      </div>
    </aside>
  );
}
