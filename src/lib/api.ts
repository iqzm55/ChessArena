type ViteEnv = {
  VITE_API_URL?: string;
  VITE_API_BASE_URL?: string;
  VITE_WS_URL?: string;
  PROD?: boolean;
};

/**
 * API base URL: use proxy in dev (empty = same origin),
 * or VITE_API_URL / VITE_API_BASE_URL in production.
 */
const env = (import.meta as unknown as { env?: ViteEnv }).env;
const API_BASE = env?.VITE_API_URL ?? env?.VITE_API_BASE_URL ?? '';

export function getApiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(getApiUrl(path), { ...init, headers });
}

export async function apiJson<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

/** WebSocket URL for game server (use same host with proxy, or VITE_WS_URL). */
export function getWsUrl(): string {
  if (env?.VITE_WS_URL) return env.VITE_WS_URL;
  if (env?.PROD && API_BASE) {
    const wsBase = API_BASE.replace(/^http/, 'ws').replace(/\/$/, '');
    return `${wsBase}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}
