import { useState, useEffect, useCallback } from "react";
import { UserPlus } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { useOrg } from "../context/OrgContext";
import { roleMeta, ROLES } from "../data/roles";

const INVITABLE_ROLES = Object.keys(ROLES).filter((r) => r !== "OWNER");

export default function OrgSettings() {
  const { activeOrg, createOrg } = useOrg();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DEVELOPER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteOk, setInviteOk] = useState(null);

  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const canInvite = activeOrg && ["OWNER", "ADMIN"].includes(activeOrg.role);

  const loadMembers = useCallback(() => {
    if (!activeOrg) return;
    setLoading(true);
    api.getOrgMembers(activeOrg.id).then(setMembers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [activeOrg]);

  useEffect(loadMembers, [loadMembers]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteOk(null);
    try {
      const member = await api.inviteMember(activeOrg.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteOk(`Added ${member.name} as ${roleMeta(member.role).label}`);
      setInviteEmail("");
      loadMembers();
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      await createOrg(newOrgName.trim());
      setNewOrgName("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (!activeOrg) return <div className="p-6 text-sm text-zinc-500">No organization selected.</div>;

  return (
    <div className="h-full overflow-y-auto">
      <Header title="Organization" subtitle={activeOrg.name} />
      <div className="p-6 space-y-6 max-w-2xl">
        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}

        <div className="rounded-lg border border-zinc-800 bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300">
            Members {!loading && <span className="text-zinc-600">({members.length})</span>}
          </div>
          <ul className="divide-y divide-zinc-800">
            {members.map((m) => {
              const role = roleMeta(m.role);
              return (
                <li key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`h-7 w-7 rounded-full ${m.color} flex items-center justify-center text-[10px] font-mono text-zinc-950`}>{m.initials}</div>
                  <span className="text-sm text-zinc-200 flex-1">{m.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${role.badge}`}>{role.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {canInvite && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-300 mb-3 flex items-center gap-1.5"><UserPlus size={14} /> Invite a member</div>
            <p className="text-[11px] text-zinc-600 mb-3">They need an existing DevFlow account (any org) — inviting by email adds them to this org.</p>
            {inviteError && <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{inviteError}</div>}
            {inviteOk && <div className="mb-3 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900 rounded-md px-3 py-2">{inviteOk}</div>}
            <form onSubmit={handleInvite} className="flex gap-2">
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{roleMeta(r).label}</option>)}
              </select>
              <button type="submit" disabled={inviting} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-medium px-4 py-2 rounded-md transition-colors">
                {inviting ? "Adding..." : "Invite"}
              </button>
            </form>
          </div>
        )}

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-sm text-zinc-300 mb-3">Create a new organization</div>
          <form onSubmit={handleCreateOrg} className="flex gap-2">
            <input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Organization name"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <button type="submit" disabled={creating} className="border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 text-zinc-200 text-sm font-medium px-4 py-2 rounded-md transition-colors">
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
          <p className="text-[11px] text-zinc-600 mt-2">You become Owner. Switch to it from the sidebar.</p>
        </div>
      </div>
    </div>
  );
}
