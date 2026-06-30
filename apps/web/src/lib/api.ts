import { createClient } from './client';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function resolveToken(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  // Fallback: re-derive from Supabase server in case cookies haven't been read yet
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  return refreshed?.access_token ?? null;
}

// Ensure the NestJS profile row exists. Called once per page-load cycle on 401.
// Cached so parallel API calls don't fire multiple sync requests.
let profileSyncPromise: Promise<void> | null = null;

async function ensureProfile(token: string): Promise<void> {
  if (profileSyncPromise) return profileSyncPromise;

  profileSyncPromise = (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fullName: string = user.user_metadata?.full_name || '';
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || user.email?.split('@')[0] || 'User';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
      const role = (user.user_metadata?.role as string || 'PATIENT').toUpperCase();

      await fetch(`${BASE}/auth/sync-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName, role }),
      });
    } catch { /* non-fatal */ }
  })();

  return profileSyncPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, _retry = true): Promise<T> {
  const token = await resolveToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      // Only send Content-Type when there is a body — Fastify rejects JSON content-type with empty body
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers ?? {}) as Record<string, string>),
    },
  });

  // On first 401: sync the profile (creates DB row if missing) then retry once.
  if (res.status === 401 && _retry && token) {
    await ensureProfile(token);
    return apiFetch<T>(path, init, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed: ${res.status}`;
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* noop */ }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);

export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });

export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' });

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const token = await resolveToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    // No Content-Type header — browser sets multipart/form-data boundary automatically
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed: ${res.status}`;
    try { message = (JSON.parse(text) as { message?: string }).message ?? message; } catch { /* noop */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getWsToken(): Promise<string | null> {
  return resolveToken();
}
