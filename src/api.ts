import {
  SCALEV_API_BASE,
  SCALEV_STORE_UNIQUE_ID,
  SCALEV_STOREFRONT_API_KEY
} from "./config";
import type { ApiDiagnostics, ApiResult } from "./types";

type RequestOptions = Omit<RequestInit, "body" | "headers" | "mode"> & {
  body?: unknown;
  token?: string | null;
};

let guestToken =
  typeof window === "undefined" ? "" : window.localStorage.getItem("scalev_guest_token") || "";

export async function probeScalev(): Promise<ApiDiagnostics> {
  if (!SCALEV_STOREFRONT_API_KEY) {
    return {
      directUsable: false,
      message: "Direct mode is unavailable because no publishable storefront key was bundled."
    };
  }

  try {
    const direct = await requestJson("public/categories", { method: "GET" });
    if (direct.ok) {
      return {
        directUsable: true,
        message: "Direct browser-to-Scalev Storefront API calls are active."
      };
    }

    return {
      directUsable: false,
      message: `Direct Scalev call failed with HTTP ${direct.status}.`
    };
  } catch (error) {
    return {
      directUsable: false,
      message: `Direct Scalev call failed before a usable response: ${formatError(error)}.`
    };
  }
}

export async function scalevRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  try {
    return await requestJson<T>(path, options);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: formatError(error)
    };
  }
}

async function requestJson<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const cleanPath = path.replace(/^\/+/, "");
  const url = `${SCALEV_API_BASE}/v3/stores/${SCALEV_STORE_UNIQUE_ID}/${cleanPath}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (cleanPath.startsWith("public/")) {
    headers.set("X-Scalev-Storefront-Api-Key", SCALEV_STOREFRONT_API_KEY);
    if (guestToken && shouldUseGuestToken(cleanPath)) {
      headers.set("X-Scalev-Guest-Token", guestToken);
    }
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "omit",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const nextGuestToken =
    response.headers.get("x-scalev-guest-token") || response.headers.get("x-guest-token");
  if (nextGuestToken) {
    guestToken = nextGuestToken;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("scalev_guest_token", nextGuestToken);
    }
  }

  const requestId =
    response.headers.get("x-scalev-request-id") || response.headers.get("x-request-id");
  const text = await response.text();
  const data = parseBody(text);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: data as T,
      error: extractError(data, text),
      requestId
    };
  }

  return {
    ok: true,
    status: response.status,
    data: data as T,
    requestId
  };
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const message = obj.message || obj.error || obj.error_code || obj.status;
    if (typeof message === "string") return message;
  }

  return fallback || "Request failed";
}

function shouldUseGuestToken(path: string): boolean {
  return path.startsWith("public/cart") || path === "public/guest-checkout";
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
