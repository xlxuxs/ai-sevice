import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/auth";
import { userApi } from "../api/user";
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from "../lib/storage";

const AuthContext = createContext(null);

const DASHBOARD_ROLES = ["planner", "admin"];

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(Boolean(readStoredAuth()?.token));

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!readStoredAuth()?.token) {
      setInitializing(false);
      return null;
    }

    try {
      const profile = await userApi.me();
      if (!DASHBOARD_ROLES.includes(profile.role)) {
        logout();
        return null;
      }
      setUser(profile);
      setAuth((current) => (current ? { ...current, role: profile.role } : current));
      return profile;
    } catch {
      logout();
      return null;
    } finally {
      setInitializing(false);
    }
  }, [logout]);

  useEffect(() => {
    if (initializing) {
      refreshUser();
    }
  }, [initializing, refreshUser]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password);

    if (!DASHBOARD_ROLES.includes(result.role)) {
      clearStoredAuth();
      throw new Error("This dashboard is only available to planner and admin accounts.");
    }

    const nextAuth = {
      token: result.token,
      role: result.role,
      userId: result.userId,
    };
    writeStoredAuth(nextAuth);
    setAuth(nextAuth);

    const profile = await userApi.me();
    setUser(profile);
    return profile;
  }, []);

  const value = useMemo(
    () => ({
      auth,
      user,
      initializing,
      isAuthenticated: Boolean(auth?.token),
      role: user?.role || auth?.role,
      login,
      logout,
      refreshUser,
    }),
    [auth, user, initializing, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
