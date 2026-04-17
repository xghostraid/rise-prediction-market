# Deploy the web app on Vercel

The Next.js app lives in **`web/`**. Point Vercel at that folder and set the public env vars below.

## 1. Push the repo to GitHub

Vercel imports from Git. Commit and push `rise-prediction-market` (or your fork) so the `web/` directory is on GitHub.

## 2. Create a Vercel project

1. Open [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** your Git repository.
3. Under **Configure Project**:
   - **Root Directory**: set to **`web`** (required — do not leave it at the repo root).
   - **Framework Preset**: Next.js (auto-detected from `web/package.json`).
4. **Environment Variables** — add these (same names as `web/env.example`):

| Name | Example / notes |
|------|------------------|
| `NEXT_PUBLIC_MARKET_FACTORY` | Your `MarketFactory` contract address (e.g. `0x72fa…`) |
| `NEXT_PUBLIC_RISE_RPC` | Public RISE RPC URL, e.g. `https://testnet.riselabs.xyz` |
| `NEXT_PUBLIC_ORDERBOOK_FACTORY` | Optional — your `OrderBookFactory` address |
| `NEXT_PUBLIC_INDEXER_URL` | Optional — **must be `https://` and publicly reachable** (not `http://127.0.0.1`). Deploy the `indexer/` service to Railway, Render, Fly.io, etc., then paste its URL (no trailing slash). If unset, the UI falls back to on-chain reads (heavier / rate limits). |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional — only if you use WalletConnect; add your Vercel production URL to the Reown allowlist |

5. Click **Deploy**.

After the first deploy, open **Settings → Domains** to use your default `*.vercel.app` URL or a custom domain.

## 3. Local CLI (optional)

From `web/`:

```bash
cd web
npx vercel login
npx vercel link
npx vercel --prod
```

Ensure the linked project’s **Root Directory** is `web` in the Vercel dashboard if the repo is monorepo-style.

## 4. Build check

Production build (from `web/`):

```bash
cd web && npm run build
```

If this passes locally, Vercel’s build should succeed with the same env vars configured in the dashboard.
