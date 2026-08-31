import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  clearSession,
  getStoredPermissions,
  getStoredToken,
  getStoredUser,
  storePermissions,
  storeSession,
} from "../api/client";
import { AdminAuthContext, type AdminAuthState } from "./useAdminAuth";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [permissions, setPermissions] = useState<string[]>(() => getStoredPermissions());
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(() => Boolean(getStoredToken()));

  // On page load: if we have a token, revalidate against /auth/me.
  useEffect(() => {
    let cancelled = false;
    const storedToken = getStoredToken();
    if (!storedToken) {
      return;
    }
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setToken(storedToken);
        setPermissions(res.permissions);
        storePermissions(res.permissions);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setUser(null);
        setToken(null);
        setPermissions([]);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const res = await api.login(email, password);
      storeSession(res.token, res.user, remember, res.permissions);
      setUser(res.user);
      setToken(res.token);
      setPermissions(res.permissions);
      return res.user;
    },
    []
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
    setPermissions([]);
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({ user, token, permissions, isBootstrapping, login, logout }),
    [user, token, permissions, isBootstrapping, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}