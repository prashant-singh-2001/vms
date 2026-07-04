import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { getToken, setToken } from "../api/client";

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERNAME_KEY = "vms.username";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));

  const applyAuth = useCallback((newToken: string, newUsername: string) => {
    setToken(newToken);
    localStorage.setItem(USERNAME_KEY, newUsername);
    setTokenState(newToken);
    setUsername(newUsername);
  }, []);

  const login = useCallback(
    async (u: string, p: string) => {
      const res = await authApi.login(u, p);
      applyAuth(res.token, res.user.username);
    },
    [applyAuth],
  );

  const signup = useCallback(
    async (u: string, p: string) => {
      const res = await authApi.signup(u, p);
      applyAuth(res.token, res.user.username);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USERNAME_KEY);
    setTokenState(null);
    setUsername(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, username, isAuthenticated: Boolean(token), login, signup, logout }),
    [token, username, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
