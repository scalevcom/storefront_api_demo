# Scalev Storefront API v3 Demo

Cloudflare Pages storefront demo for `demo.scalev.shop`, backed only by Scalev Storefront API v3.

This repo intentionally does not depend on Nexus or any private Scalev code. Runtime behavior is based on:

- https://docs.scalev.com/api-reference
- https://api-openapi.scalev.com/specs/v3/openapi.json
- live responses from `https://api.scalev.com`

## Local Development

```bash
npm install
npm run build
npm run pages:dev
```

Local development needs a Vite environment variable:

```bash
VITE_SCALEV_API_BASE=https://api.scalev.com
VITE_SCALEV_STORE_UNIQUE_ID=store_vlzpML8edzxO5roOdV7Oyfn6
VITE_SCALEV_STOREFRONT_API_KEY=<publishable storefront key>
SCALEV_BUSINESS_STORE_ID=3288
```

## Live Smoke Tests

```bash
set -a; source .envrc; set +a
npm run live:smoke
```

The storefront runtime calls Scalev directly from the browser with `VITE_SCALEV_STORE_UNIQUE_ID` and `VITE_SCALEV_STOREFRONT_API_KEY`. The smoke script can use `SCALEV_BUSINESS_STORE_ID` only to discover the existing publishable storefront key when `SCALEV_STOREFRONT_API_KEY` is missing or stale.

## Deployment

Pushes to `main` deploy `dist` to the Cloudflare Pages project `storefront-api-demo` through `.github/workflows/deploy.yml`.

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_SCALEV_STOREFRONT_API_KEY`
