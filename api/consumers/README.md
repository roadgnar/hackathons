# Cyvl API Consumer — Interactive Explorer

A local Swagger UI + authenticated proxy for the Cyvl data API
(`https://i3.cyvl.app`). Auto-authenticates on startup, refreshes tokens in
the background, and **never exposes your JWT to the browser**.

## What you get

- The full Swagger UI for the Cyvl data API at `http://localhost:3000`
- Every "Try it out" call routed through a same-origin proxy that injects
  your JWT server-side — the browser never holds credentials
- A reusable `GET /api/proxy/*` proxy endpoint for scripts/curl/Postman
- Automatic token refresh (rotated refresh tokens persisted back to `.env`)
- Read-only by design: write methods (PUT/PATCH/DELETE) are rejected at the
  proxy, and the underlying data API has no write endpoints

## Prerequisites

- Node.js 18+ (uses native `fetch`)
- A Cyvl account
- `go-task` (already installed via cyvvy) — optional, you can also use `npm`

## Setup

```bash
cd api/consumers

# Configure credentials (one directory up — shared across api/ tools)
task setup
# Then edit ../.env:
#   - Paste CYVL_REFRESH_TOKEN from https://cyvl.app/auth/debug  (recommended)
#   - OR set CYVL_EMAIL + CYVL_PASSWORD (only if your account has a password)

task start
```

Then open [http://localhost:3000](http://localhost:3000). The Swagger UI
loads, every "Try it out" call is authenticated automatically.

### Credentials precedence

If both are set in `.env`, the refresh token is tried first. If the refresh
token has been revoked or is invalid, the app falls back to email+password
(if provided). After any successful auth, the rotated refresh token is
written back to `.env` so subsequent starts use it automatically.

## Using the proxy from scripts

While the server is running, hit the proxy directly — no auth header needed
on the local side (the server adds it for you):

```bash
curl -s http://localhost:3000/api/proxy/api/v1/projects | jq
curl -s "http://localhost:3000/api/proxy/api/v1/pavement/scores?project_id=..." | jq
```

The proxy mirrors every endpoint at `i3.cyvl.app` 1:1 under `/api/proxy/`.

## How it works

1. On startup, the server reads `CYVL_REFRESH_TOKEN` (and/or `CYVL_EMAIL` +
   `CYVL_PASSWORD`) from `.env`.
2. It performs the two-step auth flow (Supabase grant → Cyvl token exchange)
   and caches the resulting Cyvl JWT in memory.
3. The rotated refresh token returned by Supabase is written back to `.env`,
   so the next startup uses it automatically.
4. It serves Swagger UI at `/`, configured to fetch a server-rewritten copy
   of `openapi.json` whose `servers` block points at `/api/proxy`. All
   browser → API traffic flows through the local proxy.
5. The proxy forwards each request to `https://i3.cyvl.app` with a fresh
   `Authorization: Bearer <jwt>` header attached server-side.
6. Token expiry is checked before each use (refreshed within 5 min of expiry);
   a 50-min background timer also keeps the token warm during idle periods.

## Security properties

- Server binds to `localhost` only — not reachable from the LAN
- JWT lives in process memory only, never in any HTTP response
- Refresh token sits in `api/.env`, which is ignored by the repo-root
  `.gitignore`
- The proxy rejects DELETE / PUT / PATCH at the express layer; the
  underlying data API has no write endpoints
- The browser-side Swagger UI never sees the JWT and cannot derive it

## Scripts

| Command | What it does |
|---------|--------------|
| `task setup` | First-time setup — copies `.env.example` and installs deps |
| `task start` / `npm start` | Run the server |
| `task dev` / `npm run dev` | Run with file-watch auto-reload |
| `task check-env` | Verify `.env` has at least one credential set |

## Troubleshooting

- **`Missing credentials`** — copy `../.env.example` to `../.env` and fill in
  either `CYVL_REFRESH_TOKEN` or `CYVL_EMAIL`+`CYVL_PASSWORD`.
- **`Refresh token failed`** — the token was revoked (e.g. you logged out at
  cyvl.app). Grab a fresh one from https://cyvl.app/auth/debug and update
  `CYVL_REFRESH_TOKEN` in `.env`.
- **401 from the data API in Swagger UI** — your account may not be
  associated with an org. Log in at https://cyvl.app once to confirm.
- **EADDRINUSE on port 3000** — set `PORT=3001` (or any free port) in
  `../.env`.
- **CORS errors** — should never happen with the proxy architecture; all
  browser traffic is same-origin. If you see one, the server isn't running
  or the spec endpoint is failing — check the server logs.
