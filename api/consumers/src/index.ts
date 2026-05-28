import { config } from "dotenv";
import { resolve } from "path";

// Prefer api/.env (one level up); fall back to api/consumers/.env if user put it there.
const PRIMARY_ENV = resolve(process.cwd(), "../.env");
const FALLBACK_ENV = resolve(process.cwd(), ".env");
config({ path: PRIMARY_ENV });
config({ path: FALLBACK_ENV });

import { existsSync } from "node:fs";
import { CyvlAuth } from "./auth.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  const email = process.env.CYVL_EMAIL || undefined;
  const password = process.env.CYVL_PASSWORD || undefined;
  const refreshToken = process.env.CYVL_REFRESH_TOKEN || undefined;

  // Persist refreshed tokens back to PRIMARY .env (create it if missing).
  const envPath = existsSync(PRIMARY_ENV) ? PRIMARY_ENV : FALLBACK_ENV;
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const auth = new CyvlAuth({ email, password, refreshToken, envPath });

  // If we have credentials, try to auth eagerly so the first browser request
  // doesn't pay the cost. If it fails, log and continue — the user can sign
  // in via the UI to recover.
  if (auth.hasCredentials()) {
    try {
      await auth.getToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[auth] Stored credentials are invalid (${msg}). Sign in via the UI.`,
      );
    }
  } else {
    console.log("[auth] No stored credentials. Sign in via the web UI.");
  }

  // Proactive refresh: re-auth every 50 min so the token is always warm.
  // Skipped silently when there are no credentials yet.
  const REFRESH_INTERVAL_MS = 50 * 60 * 1000;
  const refreshTimer = setInterval(() => {
    if (!auth.hasCredentials()) return;
    auth.getToken().catch((err: unknown) => {
      console.error(
        "[auth] Background refresh failed:",
        err instanceof Error ? err.message : err,
      );
    });
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref();

  await startServer(auth, port);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
