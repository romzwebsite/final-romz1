"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CUSTOMER_STORAGE_KEY,
  loginAccount,
  logoutAccount,
  refreshSession,
  registerAccount,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth";
import { ApiError } from "@/lib/api";

const STORAGE_KEY = CUSTOMER_STORAGE_KEY;

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  // true until the stored session has been restored/refreshed on mount
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession | null) => void;
  refreshAccessToken: () => Promise<string | null>;
  authRequest: <T>(request: (accessToken?: string) => Promise<T>) => Promise<T>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStored = (): AuthSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<AuthSession | null>(null);

  const setSession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage unavailable (private mode) — keep the in-memory session
    }
  }, []);

  // Restore the session on first load. JSON-token sessions send the stored
  // refresh token; older/cookie-only sessions use the HTTP-only cookie.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const stored = readStored();
      if (stored) setSession(stored);

      try {
        const fresh = await refreshSession(stored?.refreshToken);
        if (!cancelled) {
          setSession({
            ...fresh,
            refreshToken: fresh.refreshToken ?? stored?.refreshToken,
          });
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) {
            setSession(null);
          } else if (!stored) {
            setSession(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = sessionRef.current?.refreshToken;
      const fresh = await refreshSession(refreshToken);
      setSession({
        ...fresh,
        refreshToken: fresh.refreshToken ?? sessionRef.current?.refreshToken,
      });
      return fresh.accessToken;
    } catch {
      setSession(null);
      return null;
    }
  }, [setSession]);

  const authRequest = useCallback(
    async <T,>(request: (accessToken?: string) => Promise<T>) => {
      const currentToken = sessionRef.current?.accessToken;

      try {
        return await request(currentToken ?? undefined);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 401
        ) {
          const refreshedToken = await refreshAccessToken();
          if (refreshedToken) {
            return request(refreshedToken);
          }
        }
        throw error;
      }
    },
    [refreshAccessToken]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await loginAccount({ email, password });
      setSession(next);
      return next.user;
    },
    [setSession]
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; phone?: string }) => {
      const next = await registerAccount(input);
      setSession(next);
      return next.user;
    },
    [setSession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutAccount(sessionRef.current?.refreshToken);
    } catch {
      // even if the server call fails, drop the local session
    }
    setSession(null);
  }, [setSession]);

  const updateUser = useCallback(
    (user: AuthUser) => {
      setSessionState((current) => {
        if (!current) return current;
        const next = { ...current, user };
        sessionRef.current = next;
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      loading,
      login,
      register,
      logout,
      setSession,
      refreshAccessToken,
      authRequest,
      updateUser,
    }),
    [
      session,
      loading,
      login,
      register,
      logout,
      setSession,
      refreshAccessToken,
      authRequest,
      updateUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
