# Cyvl Infrastructure Data API

Tools for consuming the [Cyvl](https://cyvl.ai) infrastructure data API
(`https://i3.cyvl.app`). The API exposes pavement scores, signs, above-ground
assets, distresses, markings, project geometries, and street-level imagery
search across the cities Cyvl has mapped.

## How auth works

The Cyvl API uses a two-step token flow under the hood:

1. Your Cyvl session is established via Supabase Auth — either by exchanging a
   **refresh token** (recommended, and required for Google-SSO accounts) or by
   **password grant** (only works on accounts that have a password set).
2. The resulting Supabase session token is exchanged at the Cyvl auth worker
   (RFC 8693 token-exchange) for a Cyvl-signed JWT containing your `org_id`.
3. The Cyvl JWT is what the data API accepts as a Bearer token (~1 hr lifetime).

The consumer tools in this folder handle both steps and the refresh loop for
you. **Refresh tokens rotate on each use** — the rotated value is automatically
written back to `.env`, so once it's set you never have to touch the file
again.

## Setup

```bash
cp .env.example .env
# Edit .env — fill in CYVL_REFRESH_TOKEN (recommended) or CYVL_EMAIL+CYVL_PASSWORD
```

### Getting your refresh token (recommended)

1. Log in at https://cyvl.app (Google SSO or otherwise)
2. While logged in, open https://cyvl.app/auth/debug
3. Copy the `refresh_token` value from the session JSON
4. Paste it into `.env` as `CYVL_REFRESH_TOKEN=...`

Works for any account type, including SSO-only accounts that have no password.

## Directory

| Path | Description |
|------|-------------|
| [consumers/](consumers/) | Interactive TypeScript Swagger UI explorer (Express + swagger-ui-dist) |
| `.env.example` | Environment variable template |
| `.env` | Your local credentials (gitignored — do not commit) |

See [consumers/README.md](consumers/README.md) for usage.

## Hackathon distribution

If you want to hand this off to hackathon participants, the architecture is
already set up to keep things safe **per participant** — but the credential
model itself is the thing to think about:

### What's secure by construction

- Each participant runs their own copy locally; nothing is shared infra.
- The local server binds to `localhost` only — never reachable from the LAN.
- The JWT never leaves the server process; the browser only talks to the
  same-origin proxy. There is no JS-readable token surface.
- The proxy rejects write methods, and the underlying data API has no write
  endpoints either — read-only by design.
- The repo-root `.gitignore` ignores every `.env*` except `.env.example`, so
  credentials cannot be accidentally committed.

### What you must decide

Each participant needs Cyvl credentials. Three options, in order of safety:

1. **Each participant has their own Cyvl account** — they paste their own
   `CYVL_REFRESH_TOKEN`. Audit trail is per-person, revocation is per-person,
   data access matches their org membership. This is the right default.
2. **A dedicated "hackathon" Cyvl org with curated read-only data** — Cyvl
   provisions a single demo org with a hand-picked project set, and creates
   one account per team. Same code, but participants see only the demo data.
   Recommended if you want strict scoping.
3. **Do NOT share a personal refresh token** — if one person's refresh token
   is shared with N participants, all of them impersonate that user. Audit
   logs collapse to one identity, and revoking the session breaks everyone
   at once. Avoid.

### What is NOT in scope

- Multi-tenant isolation in this app — there is none, because there's no
  shared instance. Isolation comes from the data API's per-JWT org claim
  (`org_id`) and supa-gate's role-based RLS, both enforced server-side at
  Cyvl regardless of what the participant's local copy does.
- Trusting the participant's machine — if their laptop is compromised, the
  refresh token is exposed. That's true of any credential file; outside the
  scope of this tool.
