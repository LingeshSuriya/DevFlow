import { LayoutGrid, Columns3, MessageSquare, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleMeta } from "../data/roles";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/board", label: "Board", icon: Columns3 },
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const role = roleMeta(user?.role);

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
      <div className="px-4 h-14 flex items-center border-b border-zinc-800">
        <span className="font-mono text-sm tracking-tight text-emerald-400">devflow</span>
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`
              }
            >
              <Icon size={16} strokeWidth={2} />
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <div
            className={`h-7 w-7 rounded-full ${user?.color || "bg-zinc-600"} flex items-center justify-center text-[11px] font-mono text-zinc-950 shrink-0`}
          >
            {user?.initials || "?"}
          </div>
          <div className="text-xs min-w-0 flex-1">
            <div className="text-zinc-200 leading-tight truncate">{user?.name}</div>
            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded border ${role.badge}`}>
              {role.label}
            </span>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="text-zinc-600 hover:text-zinc-300 shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
