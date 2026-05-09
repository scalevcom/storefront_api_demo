import {
  SCALEV_API_BASE,
  SCALEV_STORE_UNIQUE_ID,
  SCALEV_STOREFRONT_API_KEY
} from "./config";
import type { ApiDiagnostics, ApiMode, ApiResult } from "./types";

type RequestOptions = Omit<RequestInit, "body" | "headers" | "mode"> & {
  body?: unknown;
  token?: string | null;
  mode?: ApiMode;
};

let activeMode: ApiMode = "proxy";
let guestToken =
  typeof window === "undefined" ? "" : window.localStorage.getItem("scalev_guest_token") || "";

export function getActiveMode(): ApiMode {
  return activeMode;
}

export async function probeScalev(): Promise<ApiDiagnostics> {
  let directAttempted = false;
  let directUsable = false;
  let proxyUsable = false;
  let message = "";

  if (SCALEV_STOREFRONT_API_KEY) {
    directAttempted = true;
    try {
      const direct = await requestJson("direct", "public/categories", {
        method: "GET"
      });
      directUsable = direct.ok;
      if (!direct.ok) {
        message = `Direct browser call failed with HTTP ${direct.status}.`;
      }
    } catch (error) {
      message = `Direct browser call failed before a usable response: ${formatError(error)}.`;
    }
  } else {
    message = "Direct mode was skipped because no publishable storefront key was bundled.";
  }

  if (directUsable) {
    activeMode = "direct";
    return {
      mode: "direct",
      directAttempted,
      directUsable,
      proxyUsable,
      message: "Direct browser-to-Scalev Storefront API calls are usable."
    };
  }

  const proxy = await requestJson("proxy", "public/categories", { method: "GET" });
  proxyUsable = proxy.ok;
  activeMode = "proxy";

  return {
    mode: "proxy",
    directAttempted,
    directUsable,
    proxyUsable,
    message: proxyUsable
      ? `${message} Cloudflare Pages Function proxy is active.`
      : `${message} Proxy also failed with HTTP ${proxy.status}.`
  };
}

export async function scalevRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const cleanPath = path.replace(/^\/+/, "");
  const requestedMode = options.mode || activeMode;
  try {
    return await requestJson<T>(requestedMode, path, options);
  } catch (error) {
    if (requestedMode === "direct") {
      activeMode = "proxy";
      try {
        return await requestJson<T>("proxy", path, options);
      } catch (proxyError) {
        return {
          ok: false,
          status: 0,
          error: formatError(proxyError),
          mode: "proxy"
        };
      }
    }

    return {
      ok: false,
      status: 0,
      error: formatError(error),
      mode: requestedMode
    };
  }
}

async function requestJson<T = unknown>(
  mode: ApiMode,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const cleanPath = path.replace(/^\/+/, "");
  const url =
    mode === "direct"
      ? `${SCALEV_API_BASE}/v3/stores/${SCALEV_STORE_UNIQUE_ID}/${cleanPath}`
      : `/api/scalev/${cleanPath}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (mode === "direct" && cleanPath.startsWith("public/")) {
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
    credentials: mode === "direct" ? "omit" : "include",
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
      requestId,
      mode
    };
  }

  return {
    ok: true,
    status: response.status,
    data: data as T,
    requestId,
    mode
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
