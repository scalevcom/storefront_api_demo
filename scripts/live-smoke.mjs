#!/usr/bin/env node
const API_BASE = process.env.SCALEV_API_BASE || "https://api.scalev.com";
const STORE_ID = process.env.SCALEV_STORE_UNIQUE_ID || "store_vlzpML8edzxO5roOdV7Oyfn6";
const DEMO_ORIGIN = "https://demo.scalev.shop";
const storefrontKey = process.env.SCALEV_STOREFRONT_API_KEY || process.env.VITE_SCALEV_STOREFRONT_API_KEY;
const runId = Date.now();

const results = [];

if (!storefrontKey) {
  throw new Error("Set SCALEV_STOREFRONT_API_KEY or VITE_SCALEV_STOREFRONT_API_KEY before running live smoke tests.");
}

await probe("CORS preflight", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/items/count`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://demo.scalev.shop",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "x-scalev-storefront-api-key,x-scalev-guest-token,content-type"
    }
  })
);

await probe("CORS actual count", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/items/count`, {
    headers: publicHeaders({ Origin: "https://demo.scalev.shop" })
  })
);

await probe("Storefront item count", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/items/count`, {
    headers: publicHeaders()
  })
);

const itemList = await probe("Storefront item list", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/items?page_size=5`, {
    headers: publicHeaders()
  })
);

if (itemList.body?.next_cursor) {
  await probe("Storefront item list next cursor", async () =>
    fetch(
      `${API_BASE}/v3/stores/${STORE_ID}/public/items?next_cursor=${encodeURIComponent(
        itemList.body.next_cursor
      )}&page_size=5`,
      {
        headers: publicHeaders()
      }
    )
  );
}

await probe("Storefront item list page size 12", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/items?page_size=12`, {
    headers: publicHeaders()
  })
);

const itemSamples = await collectStorefrontItems(60);
const product = itemSamples.find((item) => item.entity_type === "product") || itemSamples[0];
const bundlePriceOption = itemSamples.find((item) => item.entity_type === "bundle_price_option");

if (bundlePriceOption?.slug) {
  const bundlePriceOptionId = bundlePriceOption.bundle_price_option_id || bundlePriceOption.id;

  await probe("Bundle price option detail", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/bundle-price-options/${bundlePriceOption.slug}`, {
      headers: publicHeaders()
    })
  );

  await probe("Bundle price option summary", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/checkout/summary`, {
      method: "POST",
      headers: publicHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        items: [
          {
            type: "bundle_price_option",
            bundle_price_option_id: bundlePriceOptionId,
            quantity: 1
          }
        ],
        payment_method: "bank_transfer"
      })
    })
  );

  let bundleGuestToken = "";
  await probe("Bundle price option guest cart", async () => {
    const response = await fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/cart`, {
      headers: publicHeaders()
    });
    bundleGuestToken = extractGuestToken(response);
    return response;
  });

  await probe("Add bundle price option cart item", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/cart/items`, {
      method: "POST",
      headers: publicHeaders({
        "Content-Type": "application/json",
        "X-Scalev-Guest-Token": bundleGuestToken
      }),
      body: JSON.stringify({
        type: "bundle_price_option",
        bundle_price_option_id: bundlePriceOptionId,
        quantity: 1
      })
    })
  );

  await probe("Bundle price option cart checkout", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/checkout`, {
      method: "POST",
      headers: publicHeaders({
        "Content-Type": "application/json",
        "X-Scalev-Guest-Token": bundleGuestToken
      }),
      body: JSON.stringify({
        customer_name: "Demo Customer",
        customer_email: `demo.customer+bundle-cart-${runId}@example.com`,
        customer_phone: "6281234567890",
        shipping_address: "Jl. Demo Storefront API No. 3",
        shipping_city: "Kota Jakarta Pusat",
        shipping_province: "DKI Jakarta",
        shipping_subdistrict: "Cempaka Putih",
        shipping_postal_code: "10510",
        shipping_location_id: 9089,
        payment_method: "bank_transfer"
      })
    })
  );
}

await probe("Product detail", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/products/${product?.slug || "new-digital-agis"}`, {
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
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/auth/login`, {
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
    body: JSON.stringify({ type: "variant", variant_id: 494535, quantity: 1 })
  })
);

const checkout = await probe("Guest checkout", async () =>
  fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/checkout`, {
    method: "POST",
    headers: publicHeaders({
      "Content-Type": "application/json",
      "X-Scalev-Guest-Token": guestToken
    }),
    body: JSON.stringify({
      items: [{ type: "variant", variant_id: 494535, quantity: 1 }],
      customer_name: "Demo Customer",
      customer_email: `demo.customer+variant-${runId}@example.com`,
      customer_phone: "6281234567890",
      shipping_address: "Jl. Demo Storefront API No. 3",
      shipping_city: "Kota Jakarta Pusat",
      shipping_province: "DKI Jakarta",
      shipping_subdistrict: "Cempaka Putih",
      shipping_postal_code: "10510",
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

if (bundlePriceOption?.id) {
  const bundlePriceOptionId = bundlePriceOption.bundle_price_option_id || bundlePriceOption.id;

  await probe("Bundle price option checkout", async () =>
    fetch(`${API_BASE}/v3/stores/${STORE_ID}/public/checkout`, {
      method: "POST",
      headers: publicHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        items: [
          {
            type: "bundle_price_option",
            bundle_price_option_id: bundlePriceOptionId,
            quantity: 1
          }
        ],
        customer_name: "Demo Customer",
        customer_email: `demo.customer+bundle-${runId}@example.com`,
        customer_phone: "6281234567890",
        shipping_address: "Jl. Demo Storefront API No. 3",
        shipping_city: "Kota Jakarta Pusat",
        shipping_province: "DKI Jakarta",
        shipping_subdistrict: "Cempaka Putih",
        shipping_postal_code: "10510",
        shipping_location_id: 9089,
        payment_method: "bank_transfer"
      })
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

async function collectStorefrontItems(limit) {
  const items = [];
  let endpoint = `${API_BASE}/v3/stores/${STORE_ID}/public/items?page_size=12`;
  let pageNumber = 1;

  while (endpoint && items.length < limit) {
    const response = await fetch(endpoint, {
      headers: publicHeaders()
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    results.push({
      name: `Storefront item sample page ${pageNumber}`,
      status: response.status,
      ok: response.ok,
      request_id: response.headers.get("x-request-id"),
      allow_headers: response.headers.get("access-control-allow-headers"),
      allow_origin: response.headers.get("access-control-allow-origin"),
      expose_headers: response.headers.get("access-control-expose-headers"),
      body: compactBody(body)
    });

    if (!response.ok || !Array.isArray(body?.data)) break;
    items.push(...body.data);
    endpoint =
      body.has_next && body.next_cursor
        ? `${API_BASE}/v3/stores/${STORE_ID}/public/items?next_cursor=${encodeURIComponent(
            body.next_cursor
          )}&page_size=12`
        : "";
    pageNumber += 1;
  }

  results.push({
    name: "Storefront item sample summary",
    status: 200,
    ok: true,
    body: {
      sampled: items.length,
      products: items.filter((item) => item.entity_type === "product").length,
      bundle_price_options: items.filter((item) => item.entity_type === "bundle_price_option").length
    }
  });

  return items;
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
    copy.data_count = copy.data.length;
    copy.data = copy.data.slice(0, 2);
  }
  if (copy.items && Array.isArray(copy.items)) {
    copy.items = copy.items.slice(0, 2);
  }
  return copy;
}
