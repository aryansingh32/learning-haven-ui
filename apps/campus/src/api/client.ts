// Sign-in goes through the Forge API (same accounts as the learner app);
// everything else goes to the Campus API with the Supabase access token.

const FORGE = (import.meta.env.VITE_FORGE_API_URL ?? '').replace(/\/+$/, '');
const CAMPUS = (import.meta.env.VITE_CAMPUS_API_URL ?? '').replace(/\/+$/, '');
const STORAGE_KEY = 'forge_campus_session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
  email: string;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: session lives only in memory for this tab */
  }
  current = session;
  listeners.forEach((l) => l(session));
}

let current: Session | null = loadSession();
const listeners = new Set<(s: Session | null) => void>();
export const onSessionChange = (l: (s: Session | null) => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

async function readError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const message = body?.error?.message ?? body?.error ?? body?.message ?? `Request failed (${res.status})`;
  return new ApiError(typeof message === 'string' ? message : 'Request failed', res.status, body?.details);
}

export async function signIn(email: string, password: string): Promise<Session> {
  const res = await fetch(`${FORGE}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await readError(res);
  const { data } = await res.json();
  const session: Session = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    email: data.user?.email ?? email,
  };
  saveSession(session);
  return session;
}

export function signOut() {
  saveSession(null);
}

let refreshing: Promise<Session | null> | null = null;

async function refresh(): Promise<Session | null> {
  if (!current) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${FORGE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: current!.refreshToken }),
      });
      if (!res.ok) {
        saveSession(null);
        return null;
      }
      const { data } = await res.json();
      const next: Session = {
        ...current!,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      };
      saveSession(next);
      return next;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function token(): Promise<string | null> {
  if (!current) return null;
  // Refresh a minute early so a request never lands with a just-expired token.
  if (current.expiresAt && current.expiresAt * 1000 < Date.now() + 60_000) return (await refresh())?.accessToken ?? null;
  return current.accessToken;
}

async function campusFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const t = await token();
  const res = await fetch(`${CAMPUS}/campus/v1${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && !retried && (await refresh())) return campusFetch(path, init, true);
  if (res.status === 401) saveSession(null);
  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await campusFetch(path, init);
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => api<void>(path, { method: 'DELETE' });

/** Download a file (e.g. a CSV report) that needs the auth header. */
export async function download(path: string, fallbackName: string) {
  const res = await campusFetch(path);
  if (!res.ok) throw await readError(res);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const studentAppUrl = import.meta.env.VITE_STUDENT_APP_URL ?? 'http://localhost:5173';
