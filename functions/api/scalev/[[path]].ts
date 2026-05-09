export interface Env {
  SCALEV_API_BASE?: string;
  SCALEV_STORE_UNIQUE_ID?: string;
  SCALEV_STOREFRONT_API_KEY?: string;
}

const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "OPTIONS"]);

const responseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400"
};

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseCorsHeaders });
  }

  if (!ALLOWED_METHODS.has(request.method)) {
    return json({ message: "Method not allowed" }, 405);
  }

  const publicKey = env.SCALEV_STOREFRONT_API_KEY;
  const storeId = env.SCALEV_STORE_UNIQUE_ID || "store_vlzpML8edzxO5roOdV7Oyfn6";
  const apiBase = env.SCALEV_API_BASE || "https://api.scalev.com";
  const path = normalizePath(params.path);

  if (!publicKey) {
    return json({ message: "SCALEV_STOREFRONT_API_KEY is not configured" }, 500);
  }

  if (!isAllowedPath(path)) {
    return json({ message: "This proxy only allows storefront paths" }, 403);
  }

  const incomingUrl = new URL(request.url);

  const upstreamUrl = new URL(`${apiBase}/v3/stores/${storeId}/${path}`);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers();
  headers.set("Accept", request.headers.get("Accept") || "application/json");
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  if (path.startsWith("public/") && publicKey) {
    headers.set("X-Scalev-Storefront-Api-Key", publicKey);
  }

  const authorization = request.headers.get("Authorization");
  if (authorization && path.startsWith("customers/me")) {
    headers.set("Authorization", authorization);
  }

  const guestToken = readGuestToken(request);
  if (guestToken) {
    headers.set("Cookie", `scalev_guest_token=${guestToken}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual"
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(responseCorsHeaders);
  responseHeaders.set(
    "Content-Type",
    upstream.headers.get("Content-Type") || "application/json; charset=utf-8"
  );

  const requestId = upstream.headers.get("x-request-id");
  if (requestId) responseHeaders.set("x-scalev-request-id", requestId);

  const setCookie = upstream.headers.get("set-cookie");
  const upstreamGuestToken =
    upstream.headers.get("x-scalev-guest-token") || parseGuestTokenFromSetCookie(setCookie);
  if (upstreamGuestToken) {
    responseHeaders.append(
      "Set-Cookie",
      `scalev_guest_token=${upstreamGuestToken}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure`
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
};

function normalizePath(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? param.join("/") : param || "";
  return raw.replace(/^\/+/, "").replace(/\.\./g, "");
}

function isAllowedPath(path: string): boolean {
  return (
    path.startsWith("public/") ||
    path === "customers/me" ||
    path.startsWith("customers/me/")
  );
}

function readGuestToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)scalev_guest_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseGuestTokenFromSetCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = setCookie.match(/scalev_guest_token=([^;]+)/);
  return match ? match[1] : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...responseCorsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
