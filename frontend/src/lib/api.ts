import { API_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import type { ApiErrorBody } from "@/types/contract";

export { getToken, setToken } from "@/lib/tokenStore";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "HTTP_ERROR";
  let message = response.statusText || `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch {
    // non-JSON error body
  }
  return new ApiError(response.status, code, message);
}

let onUnauthorized: (() => void) | null = null;

/** Called once per 401 outside /auth/*, so the app can sign the user out instead of showing empty pages. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function filenameFromDisposition(header: string | null): string | null {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? "");
  return match ? decodeURIComponent(match[1].trim()) : null;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (response.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { headers: { ...authHeaders() } });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  upload<T>(path: string, form: FormData): Promise<T> {
    return request<T>(path, { method: "POST", headers: { ...authHeaders() }, body: form });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE", headers: { ...authHeaders() } });
  },

  /** Fetch a protected file with the auth header and hand it to the browser as a download. */
  async download(path: string, filename: string): Promise<void> {
    const response = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
    if (!response.ok) throw await parseError(response);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    // The server names the file (Content-Disposition); the caller's name is the fallback.
    anchor.download =
      filenameFromDisposition(response.headers.get("content-disposition")) ?? filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Fetch a protected binary (slide image) and return an object URL the caller must revoke.
   *  `no-cache` makes the browser revalidate with the server (ETag) instead of trusting a
   *  cached copy, so a replaced deck never shows old pages. */
  async blobUrl(path: string): Promise<string> {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { ...authHeaders() },
      cache: "no-cache",
    });
    if (!response.ok) throw await parseError(response);
    return URL.createObjectURL(await response.blob());
  },
};
