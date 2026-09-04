import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setOrgIdGetter } from "../api";
import { joinOrgRoom, leaveOrgRoom } from "../socket";
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

  // Whenever we (re)log in, load orgs and pick a sane active one.
  useEffect(() => {
    if (!user) {
      setOrgs([]);
      setActiveOrgId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshOrgs()
      .then((list) => {
        const stillValid = list.some((o) => o.id === activeOrgId);
        const next = stillValid ? activeOrgId : list[0]?.id || null;
        setActiveOrgId(next);
        if (next) localStorage.setItem(STORAGE_KEY, next);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Join/leave the socket room whenever the active org changes.
  useEffect(() => {
    if (!activeOrgId) return;
    joinOrgRoom(activeOrgId);
    return () => leaveOrgRoom(activeOrgId);
  }, [activeOrgId]);

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
