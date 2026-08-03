import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';

/** Refresh if access token expires within this window. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let refreshInFlight: Promise<string | null> | null = null;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

export function isSupabaseClientConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && supabase);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function persistSession(session: Pick<Session, 'access_token' | 'refresh_token'>): void {
  localStorage.setItem(ACCESS_KEY, session.access_token);
  if (session.refresh_token) {
    localStorage.setItem(REFRESH_KEY, session.refresh_token);
  }
  void syncSupabaseClient(session);
}

async function syncSupabaseClient(session: Pick<Session, 'access_token' | 'refresh_token'>): Promise<void> {
  if (!supabase?.auth || !session.refresh_token) return;
  try {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch {
    /* non-fatal */
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  if (supabase?.auth) {
    void supabase.auth.signOut({ scope: 'local' });
  }
}

function decodeJwtExpiryMs(accessToken: string): number | null {
  try {
    const segment = accessToken.split('.')[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenStale(accessToken: string | null): boolean {
  if (!accessToken) return true;
  const exp = decodeJwtExpiryMs(accessToken);
  if (!exp) return false;
  return exp - Date.now() < EXPIRY_BUFFER_MS;
}

function parseRefreshResponse(body: unknown): { access_token: string; refresh_token?: string } | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const session = (record.session ?? (record.data as Record<string, unknown> | undefined)?.session) as
    | { access_token?: string; refresh_token?: string }
    | undefined;
  if (!session?.access_token) return null;
  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

async function refreshViaApi(refreshToken: string): Promise<string | null> {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) return null;

  const body = await response.json();
  const session = parseRefreshResponse(body);
  if (!session) return null;

  persistSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token || refreshToken,
  });
  return session.access_token;
}

/**
 * Exchange refresh token for a new access token (Supabase client or API fallback).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
      if (supabase?.auth) {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refresh });
        if (!error && data.session?.access_token) {
          persistSession(data.session);
          return data.session.access_token;
        }
      }

      return await refreshViaApi(refresh);
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Returns a valid access token, refreshing proactively when near expiry.
 */
export async function ensureValidAccessToken(): Promise<string | null> {
  const access = getAccessToken();
  const refresh = getRefreshToken();

  if (!refresh) {
    return access;
  }

  if (isAccessTokenStale(access)) {
    const renewed = await refreshAccessToken();
    return renewed;
  }

  return access;
}

export function startSessionRefreshScheduler(): void {
  stopSessionRefreshScheduler();
  refreshIntervalId = setInterval(() => {
    void ensureValidAccessToken();
  }, 10 * 60 * 1000);
}

export function stopSessionRefreshScheduler(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

export function subscribeToAuthSessionChanges(
  onSession: (session: Session | null) => void
): (() => void) | undefined {
  if (!supabase?.auth) return undefined;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      persistSession(session);
    }
    onSession(session);
  });

  return () => data.subscription.unsubscribe();
}
