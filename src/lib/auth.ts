// Customer authentication client for the ROMZ backend /auth endpoints.
// Auth calls include credentials for cookie support, while the JSON
// refreshToken returned by the backend is also stored by AuthProvider.

import { ApiError } from "./api";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "user" | "customer" | "admin";
  isVerified: boolean;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

/** localStorage key of the signed-in customer's AuthSession (AuthProvider). */
export const CUSTOMER_STORAGE_KEY = "romz_customer";

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

function detailMessage(data: unknown): string {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === "string").join(" · ");
  }
  if (data && typeof data === "object") {
    return Object.values(data as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string")
      .join(" · ");
  }
  return "";
}

async function authFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    credentials?: RequestCredentials;
  } = {}
): Promise<T> {
  if (!API_URL) {
    throw new ApiError("Backend is not configured", 0);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "POST",
    credentials: options.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const details = detailMessage(body?.data);
    const base = body?.message ?? res.statusText;
    throw new ApiError(
      details && details !== base ? `${base}: ${details}` : base,
      res.status,
      body?.data
    );
  }

  return body?.data as T;
}

export const registerAccount = (input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) => authFetch<AuthSession>("/auth/register", { body: input });

export const loginAccount = (input: { email: string; password: string }) =>
  authFetch<AuthSession>("/auth/login", { body: input });

export const verifyEmail = (input: { email: string; code: string }) =>
  authFetch<{ user: AuthUser }>("/auth/verify-email", { body: input });

export const resendOtp = (input: { email: string }) =>
  authFetch<void>("/auth/resend-otp", { body: input });

export const forgotPassword = (input: { email: string }) =>
  authFetch<void>("/auth/forgot-password", { body: input });

export const resetPassword = (input: { token: string; password: string }) =>
  authFetch<void>("/auth/reset-password", { body: input });

let refreshPromise: Promise<AuthSession> | null = null;

async function performRefresh(refreshToken?: string | null) {
  if (refreshToken) {
    try {
      // JSON-token mode must not include a potentially stale HTTP-only cookie,
      // because the backend gives that cookie priority over the request body.
      return await authFetch<AuthSession>("/auth/refresh", {
        body: { refreshToken },
        credentials: "omit",
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // Recover older sessions that only have the backend HTTP-only cookie.
    }
  }

  return authFetch<AuthSession>("/auth/refresh", {
    credentials: "include",
  });
}

export function refreshSession(refreshToken?: string | null) {
  if (!refreshPromise) {
    refreshPromise = performRefresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function logoutAccount(refreshToken?: string | null) {
  try {
    // Cookie mode clears the HTTP-only cookie when it is available.
    await authFetch<void>("/auth/logout", { credentials: "include" });
  } catch (error) {
    if (!refreshToken || !(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    // A stale cookie must not shadow the valid JSON refresh token fallback.
    await authFetch<void>("/auth/logout", {
      body: { refreshToken },
      credentials: "omit",
    });
  }
}

export const fetchMe = (token: string) =>
  authFetch<{ user: AuthUser }>("/users/me", { method: "GET", token });

// Maps an error thrown by the auth calls to a translation key in the
// "auth" namespace. Pages handle context-specific 400s before calling this.
export const authErrorKey = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) return "invalidCredentials";
    if (error.status === 409) return "emailTaken";
    if (error.status === 429) return "tooMany";
    if (error.status === 0) return "networkError";
    return "serverError";
  }
  return "networkError";
};
