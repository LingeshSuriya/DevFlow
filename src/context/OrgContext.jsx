import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setOrgIdGetter } from "../api";
import { socket, joinOrgRoom, leaveOrgRoom } from "../socket";
import { useAuth } from "./AuthContext";

const OrgContext = createContext(null);
const STORAGE_KEY = "devflow_active_org";

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrgIdGetter(() => activeOrgId);
  }, [activeOrgId]);

  const refreshOrgs = useCallback(async () => {
    const list = await api.getOrgs();
    setOrgs(list);
    return list;
  }, []);

  // Reload orgs and make sure the active org is still one we belong to
  // (a role change updates the badge; a removal kicks us to another org).
  const resync = useCallback(async () => {
    const list = await refreshOrgs();
    setActiveOrgId((cur) => {
      if (cur && list.some((o) => o.id === cur)) return cur;
      const next = list[0]?.id || null;
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
      return next;
    });
  }, [refreshOrgs]);

  useEffect(() => {
    if (!user) {
      setOrgs([]);
      setActiveOrgId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    resync().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!activeOrgId) return;
    joinOrgRoom(activeOrgId);
    return () => leaveOrgRoom(activeOrgId);
  }, [activeOrgId]);

  // Live role/membership changes + socket reconnects (rooms are lost on reconnect).
  useEffect(() => {
    if (!user) return;
    const onMembersChanged = ({ orgId }) => {
      if (orgId === activeOrgId) resync().catch(() => {});
    };
    const onConnect = () => {
      if (activeOrgId) joinOrgRoom(activeOrgId);
      resync().catch(() => {});
    };
    socket.on("org:members_changed", onMembersChanged);
    socket.on("connect", onConnect);
    return () => {
      socket.off("org:members_changed", onMembersChanged);
      socket.off("connect", onConnect);
    };
  }, [user, activeOrgId, resync]);

  const switchOrg = useCallback((orgId) => {
    setActiveOrgId(orgId);
    localStorage.setItem(STORAGE_KEY, orgId);
  }, []);

  const createOrg = useCallback(
    async (name) => {
      const org = await api.createOrg({ name });
      await refreshOrgs();
      switchOrg(org.id);
      return org;
    },
    [refreshOrgs, switchOrg]
  );

  const activeOrg = orgs.find((o) => o.id === activeOrgId) || null;

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, activeOrgId, loading, switchOrg, createOrg, refreshOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}
