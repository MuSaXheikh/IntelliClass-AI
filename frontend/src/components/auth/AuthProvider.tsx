"use client";

import { useRouter } from "next/navigation";
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
import { api, ApiError, setUnauthorizedHandler } from "@/lib/api";
import { AUTH_USER_KEY } from "@/lib/config";
import { clearAllJoinInfo } from "@/lib/joinStore";
import { decodeJwtExp } from "@/lib/jwt";
import { readJson, readLocal, writeLocal } from "@/lib/storage";
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

/** Refresh this long before the token expires (tokens last hours; refresh is cheap). */
const REFRESH_BEFORE_MS = 30 * 60 * 1000;

function forgetSession(): void {
  writeLocal(AUTH_USER_KEY, null);
  clearAllJoinInfo();
  setToken(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const [validated, setValidated] = useState<Validated | null>(null);

  // A stored token is only trusted once GET /me confirms it. A network or server hiccup keeps
  // the cached profile; only an explicit 401/403 signs the user out.
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
      .catch((caught: unknown) => {
        if (!active) return;
        const rejected =
          caught instanceof ApiError && (caught.status === 401 || caught.status === 403);
        const cached = rejected ? null : readJson<User>(readLocal(AUTH_USER_KEY));
        if (cached) setValidated({ token, user: cached });
        else forgetSession();
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Any 401 outside /auth/* means the token is dead: sign out and return to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!getToken()) return;
      forgetSession();
      setValidated(null);
      router.replace("/login?expired=1");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  // Renew the token well before it expires, so a long class never logs anyone out.
  useEffect(() => {
    if (!token) return;
    const exp = decodeJwtExp(token);
    if (!exp) return;
    const msLeft = exp * 1000 - Date.now();
    if (msLeft <= 0) return; // the next request's 401 signs the user out
    const timer = setTimeout(
      () => {
        api
          .post<LoginResponse>("/auth/refresh")
          .then((response) => {
            writeLocal(AUTH_USER_KEY, JSON.stringify(response.user));
            setValidated({ token: response.access_token, user: response.user });
            setToken(response.access_token);
          })
          .catch(() => undefined); // a failed refresh is retried by the next mount or ends in a 401
      },
      Math.max(60_000, msLeft - REFRESH_BEFORE_MS),
    );
    return () => clearTimeout(timer);
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
    forgetSession();
    setValidated(null);
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
