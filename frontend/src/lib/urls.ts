/** Resolve API and WebSocket base URLs (pure; unit-tested). */

export interface UrlEnv {
  api?: string;
  ws?: string;
}

export interface PageLocation {
  protocol: string;
  hostname: string;
}

export interface ResolvedUrls {
  api: string;
  ws: string;
}

const API_PORT = 8000;

/**
 * Explicit NEXT_PUBLIC_* values win (production). Otherwise the backend is assumed to run on
 * port 8000 of the host that served the page, so one build works on localhost, on a LAN
 * address during a two-device demo, and behind HTTPS (which then implies wss).
 */
export function resolveUrls(env: UrlEnv, location: PageLocation | null): ResolvedUrls {
  const host = location?.hostname || "localhost";
  const secure = location?.protocol === "https:";
  const api = env.api || `${secure ? "https" : "http"}://${host}:${API_PORT}/api/v1`;
  const ws = env.ws || `${secure ? "wss" : "ws"}://${host}:${API_PORT}/ws`;
  return { api, ws };
}
