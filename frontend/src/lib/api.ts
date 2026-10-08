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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
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

  /** Fetch a protected binary (slide image) and return an object URL the caller must revoke. */
  async blobUrl(path: string): Promise<string> {
    const response = await fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } });
    if (!response.ok) throw await parseError(response);
    return URL.createObjectURL(await response.blob());
  },
};
