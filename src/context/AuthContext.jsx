import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setTokenGetter } from "../api";
import { connectSocket, disconnectSocket } from "../socket";

const AuthContext = createContext(null);
const STORAGE_KEY = "devflow_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setTokenGetter(() => token); }, [token]);

  useEffect(() => {
    if (!token) {
      setUser(null); setLoading(false); disconnectSocket();
      return;
    }
    setLoading(true);
    api.me()
      .then((u) => { setUser(u); connectSocket(token); })
      .catch(() => { localStorage.removeItem(STORAGE_KEY); setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { token: newToken, user: newUser } = await api.login({ email, password });
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const register = useCallback(async (email, password, name, orgName) => {
    const { token: newToken, user: newUser } = await api.register({ email, password, name, orgName });
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const loginWithToken = useCallback((newToken) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null); setUser(null); disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
