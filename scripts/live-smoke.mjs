#!/usr/bin/env node
const API_BASE = process.env.SCALEV_API_BASE || "https://api.scalev.com";
const STORE_ID = process.env.SCALEV_STORE_UNIQUE_ID || "store_vlzpML8edzxO5roOdV7Oyfn6";
const BUSINESS_STORE_ID = process.env.SCALEV_BUSINESS_STORE_ID || "3288";
const BUSINESS_API_KEY = process.env.SCALEV_API_KEY;
const DEMO_ORIGIN = "https://demo.scalev.shop";
let storefrontKey = process.env.SCALEV_STOREFRONT_API_KEY || process.env.VITE_SCALEV_STOREFRONT_API_KEY;

const results = [];

if (BUSINESS_API_KEY) {
  const keys = await fetchJson(`${API_BASE}/v3/stores/${BUSINESS_STORE_ID}/public-api-keys`, {
    headers: {
      Authorization: `Bearer ${BUSINESS_API_KEY}`,
      Accept: "application/json"
    }
  });
  storefrontKey = keys.body?.data?.find((key) => key.status === "active" && key.token)?.token || storefrontKey;
}

if (!storefrontKey) {
  throw new Error("Set SCALEV_STOREFRONT_API_KEY, VITE_SCALEV_STOREFRONT_API_KEY, or SCALEV_API_KEY before running live smoke tests.");
}

await probe("CORS preflight", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products/count`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://demo.scalev.shop",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "x-scalev-storefront-api-key,x-scalev-guest-token,content-type"
    }
  })
);

await probe("CORS actual count", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products/count`, {
    headers: publicHeaders({ Origin: "https://demo.scalev.shop" })
  })
);

await probe("Product count", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products/count`, {
    headers: publicHeaders()
  })
);

const productList = await probe("Product list", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products?page_size=5`, {
    headers: publicHeaders()
  })
);

if (productList.body?.next_cursor) {
  await probe("Product list next cursor", async () =>
    fetch(
      `${API_BASE}/v3/stores/${STORE_ID}/public/products?next_cursor=${encodeURIComponent(
        productList.body.next_cursor
      )}&page_size=5`,
      {
        headers: publicHeaders()
      }
    )
  );
}

await probe("Product list page size 12", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products?page_size=12`, {
    headers: publicHeaders()
  })
);

await probe("Product detail", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products/new-digital-agis`, {
    headers: publicHeaders()
  })
);

await probe("Categories", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/categories`, {
    headers: publicHeaders()
  })
);

await probe("Public payment methods", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/payment-methods`, {
    headers: publicHeaders()
  })
);

await probe("Public location provinces", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/locations/provinces`, {
    headers: publicHeaders()
  })
);

await probe("Public location cities", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/locations/cities?province_id=6`, {
    headers: publicHeaders()
  })
);

await probe("Public location subdistricts", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/locations/subdistricts?city_id=152`, {
    headers: publicHeaders()
  })
);

await probe("Public location search", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/locations?search=Cempaka%20Putih&page_size=3`, {
    headers: publicHeaders()
  })
);

await probe("Public location postal codes", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/locations/9089/postal-codes`, {
    headers: publicHeaders()
  })
);

await probe("Customer login preflight", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/auth/otp/send`, {
    method: "OPTIONS",
    headers: {
      Origin: DEMO_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-scalev-storefront-api-key,content-type"
    }
  })
);

await probe("Password reset preflight", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/auth/forget-password`, {
    method: "OPTIONS",
    headers: {
      Origin: DEMO_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-scalev-storefront-api-key,content-type"
    }
  })
);

await probe("Save password invalid token", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/auth/save-password`, {
    method: "POST",
    headers: publicHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      token: "not-a-real-reset-token",
      password: "not-a-real-password"
    })
  })
);

let guestToken = "";
await probe("Guest cart", async () => {
  const response = await fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/cart`, {
    headers: publicHeaders()
  });
  guestToken = extractGuestToken(response);
  return response;
});

await probe("Add cart item", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/cart/items`, {
    method: "POST",
    headers: publicHeaders({
      "Content-Type": "application/json",
      "X-Scalev-Guest-Token": guestToken
    }),
    body: JSON.stringify({ variant_id: 494535, quantity: 1 })
  })
);

const checkout = await probe("Guest checkout", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/guest-checkout`, {
    method: "POST",
    headers: publicHeaders({
      "Content-Type": "application/json",
      "X-Scalev-Guest-Token": guestToken
    }),
    body: JSON.stringify({
      items: [{ variant_id: 494535, quantity: 1 }],
      customer_name: "Demo Customer",
      customer_email: "demo.customer@example.com",
      customer_phone: "6281234567890",
      shipping_address: "Jl. Demo Storefront API No. 3",
      shipping_city: "Kota Jakarta Pusat",
      shipping_province: "DKI Jakarta",
      shipping_subdistrict: "Cempaka Putih",
      shipping_postal_code: "10510",
      location_id: 9089,
      shipping_location_id: 9089,
      payment_method: "bank_transfer"
    })
  })
);

const orderSecret = checkout.body?.order_secret_slug || checkout.body?.secret_slug;
if (orderSecret) {
  await probe("Public order read", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/orders/${orderSecret}`, {
      headers: publicHeaders()
    })
  );

  await probe("Public order payment", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/orders/${orderSecret}/payment`, {
      method: "POST",
      headers: publicHeaders()
    })
  );
}

await probe("Unknown order lookup", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/orders/not-a-real-secret`, {
    headers: publicHeaders()
  })
);

console.log(JSON.stringify(results, null, 2));

function publicHeaders(extra = {}) {
  return {
    Accept: "application/json",
    Origin: DEMO_ORIGIN,
    "X-Scalev-Storefront-Api-Key": storefrontKey,
    ...extra
  };
}

async function probe(name, fn) {
  const response = await fn();
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const result = {
    name,
    status: response.status,
    ok: response.ok,
    request_id: response.headers.get("x-request-id"),
    allow_headers: response.headers.get("access-control-allow-headers"),
    allow_origin: response.headers.get("access-control-allow-origin"),
    expose_headers: response.headers.get("access-control-expose-headers"),
    body: compactBody(body)
  };
  results.push(result);
  return result;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null
  };
}

function extractGuestToken(response) {
  const headerToken =
    response.headers.get("x-scalev-guest-token") || response.headers.get("x-guest-token");
  if (headerToken) return headerToken;
  const cookie = response.headers.get("set-cookie") || "";
  const match = cookie.match(/scalev_guest_token=([^;]+)/);
  return match ? match[1] : "";
}

function compactBody(body) {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.slice(0, 2);
  const copy = { ...body };
  if (Array.isArray(copy.data)) {
    copy.data = copy.data.slice(0, 2);
  }
  if (copy.items && Array.isArray(copy.items)) {
    copy.items = copy.items.slice(0, 2);
  }
  return copy;
}
