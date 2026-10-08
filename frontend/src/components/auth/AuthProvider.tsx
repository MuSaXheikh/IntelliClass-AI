"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { AUTH_USER_KEY } from "@/lib/config";
import { writeLocal } from "@/lib/storage";
import { getToken, setToken, subscribeToken } from "@/lib/tokenStore";
import type { LoginResponse, RegisterRequest, User } from "@/types/contract";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (request: RegisterRequest) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function homePathFor(user: User | null): string {
  if (!user) return "/login";
  return user.role === "instructor" || user.role === "admin" ? "/instructor" : "/student";
}

interface Validated {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const [validated, setValidated] = useState<Validated | null>(null);

  // A stored token is only trusted once GET /me confirms it.
  useEffect(() => {
    if (!token) return;
    let active = true;
    api
      .get<User>("/me")
      .then((me) => {
        if (!active) return;
        setValidated({ token, user: me });
        writeLocal(AUTH_USER_KEY, JSON.stringify(me));
      })
      .catch(() => {
        if (!active) return;
        writeLocal(AUTH_USER_KEY, null);
        setToken(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const user = validated && validated.token === token ? validated.user : null;
  const loading = token !== null && user === null;

  const applySession = useCallback((response: LoginResponse) => {
    writeLocal(AUTH_USER_KEY, JSON.stringify(response.user));
    setValidated({ token: response.access_token, user: response.user });
    setToken(response.access_token);
    return response.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      applySession(await api.post<LoginResponse>("/auth/login", { email, password })),
    [applySession],
  );

  const register = useCallback(
    async (request: RegisterRequest) => {
      await api.post<User>("/auth/register", request);
      return applySession(
        await api.post<LoginResponse>("/auth/login", {
          email: request.email,
          password: request.password,
        }),
      );
    },
    [applySession],
  );

  const logout = useCallback(() => {
    writeLocal(AUTH_USER_KEY, null);
    setValidated(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
