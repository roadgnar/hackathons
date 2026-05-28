import express from "express";
import swaggerUiDist from "swagger-ui-dist";
import { Readable } from "node:stream";
import { CyvlAuth, SUPABASE_URL, SUPABASE_ANON_KEY } from "./auth.js";

const UPSTREAM = "https://i3.cyvl.app";

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Cyvl API Explorer</title>
    <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .topbar { background: #0b1f3a; padding: 8px 16px; color: #fff; display: flex; justify-content: space-between; align-items: center; font: 14px system-ui; }
      .topbar a { color: #9ec5ff; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="topbar"><span>Cyvl API Explorer — signed in</span><a href="/auth/logout">Sign out</a></div>
    <div id="swagger-ui"></div>
    <script src="/swagger-ui/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
        });
      };
    </script>
  </body>
</html>
`;

function loginHtml(error?: string): string {
  const errorBlock = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sign in — Cyvl API Explorer</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; font: 15px system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; }
      @media (prefers-color-scheme: dark) { body { background: #0b0d10; color: #e5e7eb; } }
      .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.06); padding: 32px; width: 380px; max-width: 92vw; }
      @media (prefers-color-scheme: dark) { .card { background: #161a1f; box-shadow: 0 4px 24px rgba(0,0,0,.5); } }
      h1 { font-size: 20px; margin: 0 0 4px; font-weight: 600; }
      p.sub { margin: 0 0 24px; color: #6b7280; font-size: 13px; }
      button, .btn { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #111; font: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; transition: background .15s; }
      button:hover, .btn:hover { background: #f3f4f6; }
      @media (prefers-color-scheme: dark) { button, .btn { background: #1f242b; border-color: #2c333c; color: #e5e7eb; } button:hover, .btn:hover { background: #262c34; } }
      button.primary { background: #0b1f3a; color: #fff; border-color: #0b1f3a; }
      button.primary:hover { background: #163765; }
      .divider { display: flex; align-items: center; gap: 12px; color: #9ca3af; font-size: 12px; margin: 16px 0; }
      .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
      @media (prefers-color-scheme: dark) { .divider::before, .divider::after { background: #2c333c; } }
      label { display: block; font-size: 12px; color: #6b7280; margin: 12px 0 4px; }
      input, textarea { width: 100%; padding: 9px 11px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #111; font: inherit; }
      textarea { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; min-height: 80px; resize: vertical; }
      @media (prefers-color-scheme: dark) { input, textarea { background: #1f242b; border-color: #2c333c; color: #e5e7eb; } }
      .error { background: #fee2e2; color: #991b1b; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
      @media (prefers-color-scheme: dark) { .error { background: #3b1f1f; color: #fca5a5; } }
      .toggle { text-align: center; margin-top: 12px; font-size: 13px; }
      .toggle a { color: #2563eb; text-decoration: none; cursor: pointer; }
      .hidden { display: none; }
      .footer { margin-top: 18px; text-align: center; color: #9ca3af; font-size: 11px; }
      svg.icon { width: 16px; height: 16px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sign in to Cyvl</h1>
      <p class="sub">Authenticate to explore the Cyvl Infrastructure Data API.</p>
      ${errorBlock}

      <button id="google-btn">
        <svg class="icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        Continue with Google
      </button>

      <button id="microsoft-btn">
        <svg class="icon" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
        Continue with Microsoft
      </button>

      <div class="divider">or</div>

      <form id="password-form">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="email" required />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
        <button type="submit" class="primary" style="margin-top: 14px;">Sign in with password</button>
      </form>

      <div class="toggle">
        <a id="token-toggle">Paste a refresh token instead</a>
      </div>

      <form id="token-form" class="hidden">
        <label for="token">Refresh token <span style="opacity:.6">(from cyvl.app/auth/debug)</span></label>
        <textarea id="token" name="token" placeholder="Paste the refresh_token from the Session JSON" required></textarea>
        <button type="submit" class="primary">Save token &amp; sign in</button>
      </form>

      <div class="footer">Your credentials are sent only to your local server (127.0.0.1).<br>The refresh token is saved to api/.env.</div>
    </div>

    <script type="module">
      import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
      const supabase = createClient(
        ${JSON.stringify(SUPABASE_URL)},
        ${JSON.stringify(SUPABASE_ANON_KEY)},
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );

      const callbackUrl = window.location.origin + "/auth/callback";

      document.getElementById("google-btn").addEventListener("click", async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl },
        });
        if (error) alert("Google sign-in error: " + error.message);
      });

      document.getElementById("microsoft-btn").addEventListener("click", async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "azure",
          options: { redirectTo: callbackUrl, scopes: "email" },
        });
        if (error) alert("Microsoft sign-in error: " + error.message);
      });

      document.getElementById("password-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "password", email, password }),
        });
        if (r.ok) { window.location.href = "/"; }
        else { const j = await r.json().catch(() => ({})); alert(j.error || ("HTTP " + r.status)); }
      });

      document.getElementById("token-toggle").addEventListener("click", () => {
        document.getElementById("password-form").classList.toggle("hidden");
        document.getElementById("token-form").classList.toggle("hidden");
      });

      document.getElementById("token-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = document.getElementById("token").value.trim();
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "refresh_token", refreshToken: token }),
        });
        if (r.ok) { window.location.href = "/"; }
        else { const j = await r.json().catch(() => ({})); alert(j.error || ("HTTP " + r.status)); }
      });
    </script>
  </body>
</html>
`;
}

const CALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Completing sign-in…</title>
    <style>
      body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f6f7f9; font:15px system-ui; color:#1a1a1a; }
      @media (prefers-color-scheme: dark) { body { background:#0b0d10; color:#e5e7eb; } }
      .box { text-align:center; max-width:380px; padding:24px; }
      .spinner { width:32px; height:32px; border-radius:50%; border:3px solid #e5e7eb; border-top-color:#2563eb; animation:spin 1s linear infinite; margin:0 auto 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .err { color:#dc2626; margin-top:12px; font-size:13px; }
    </style>
  </head>
  <body>
    <div class="box">
      <div class="spinner"></div>
      <div id="status">Completing sign-in…</div>
      <div id="err" class="err"></div>
    </div>
    <script type="module">
      import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
      const supabase = createClient(
        ${JSON.stringify(SUPABASE_URL)},
        ${JSON.stringify(SUPABASE_ANON_KEY)},
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true, flowType: "pkce" } }
      );

      const statusEl = document.getElementById("status");
      const errEl = document.getElementById("err");

      function fail(msg) {
        statusEl.textContent = "Sign-in failed.";
        errEl.textContent = msg;
        document.querySelector(".spinner").style.display = "none";
        setTimeout(() => { window.location.href = "/"; }, 3500);
      }

      async function handleSession(session) {
        try {
          if (!session?.refresh_token) { fail("No refresh token in session."); return; }
          statusEl.textContent = "Saving credentials to local server…";
          const r = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "refresh_token", refreshToken: session.refresh_token }),
          });
          if (!r.ok) { const j = await r.json().catch(() => ({})); fail(j.error || ("HTTP " + r.status)); return; }
          // Clear browser-side Supabase state so the token doesn't linger.
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          window.location.href = "/";
        } catch (e) {
          fail(e.message || String(e));
        }
      }

      // PKCE flow: detectSessionInUrl exchanges ?code= automatically.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          handleSession(session);
        }
      });

      // Fallback: if onAuthStateChange doesn't fire (already-exchanged), poll once.
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) { subscription.unsubscribe(); handleSession(data.session); }
      }, 2000);

      // Timeout if nothing happens.
      setTimeout(() => {
        if (statusEl.textContent.startsWith("Completing")) {
          fail("Timed out waiting for sign-in.");
        }
      }, 15000);
    </script>
  </body>
</html>
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function startServer(
  auth: CyvlAuth,
  port: number,
): Promise<void> {
  const app = express();
  app.use(express.json());

  // --- Auth UI + endpoints -------------------------------------------------

  app.get("/api/auth/status", (_req, res) => {
    res.json(auth.status());
  });

  app.post("/api/auth/login", async (req, res) => {
    const body = req.body as
      | { type: "password"; email: string; password: string }
      | { type: "refresh_token"; refreshToken: string }
      | undefined;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    try {
      if (body.type === "password") {
        if (!body.email || !body.password) {
          res.status(400).json({ error: "Email and password required" });
          return;
        }
        await auth.signInWithPassword(body.email, body.password);
      } else if (body.type === "refresh_token") {
        if (!body.refreshToken) {
          res.status(400).json({ error: "Refresh token required" });
          return;
        }
        await auth.signInWithRefreshToken(body.refreshToken);
      } else {
        res.status(400).json({ error: "Unknown login type" });
        return;
      }
      res.json({ ok: true, status: auth.status() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(401).json({ error: msg });
    }
  });

  app.get("/auth/callback", (_req, res) => {
    res.type("html").send(CALLBACK_HTML);
  });

  app.get("/auth/logout", (_req, res) => {
    // We don't expose a real logout (the server holds the only copy of the
    // refresh token, intentionally). This is a friendly redirect so the menu
    // entry is meaningful — to actually sign out, delete CYVL_REFRESH_TOKEN
    // from api/.env and restart the server.
    res
      .type("html")
      .send(
        `<!doctype html><meta charset=utf-8><div style="font:15px system-ui;padding:24px;max-width:520px;margin:60px auto">
        <h2>To sign out</h2>
        <p>Delete the <code>CYVL_REFRESH_TOKEN</code> line from <code>api/.env</code> and restart the server. The server holds the only copy of your refresh token; clearing it here would leave it on disk.</p>
        <p><a href="/">Back</a></p></div>`,
      );
  });

  // --- Authenticated proxy + spec endpoints --------------------------------

  function requireAuth(
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    if (!auth.hasCredentials()) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    next();
  }

  app.get("/api/openapi.json", requireAuth, async (_req, res) => {
    try {
      const upstream = await fetch(`${UPSTREAM}/openapi.json`);
      if (!upstream.ok) {
        res.status(502).json({ error: `Upstream ${upstream.status}` });
        return;
      }
      const spec = (await upstream.json()) as {
        servers?: { url: string; description?: string }[];
        [k: string]: unknown;
      };
      spec.servers = [
        { url: "/api/proxy", description: "Local proxy (auto-authenticated)" },
      ];
      res.json(spec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: msg });
    }
  });

  const ALLOWED_METHODS = new Set(["GET", "POST", "HEAD", "OPTIONS"]);
  app.use("/api/proxy", requireAuth, async (req, res) => {
    if (!ALLOWED_METHODS.has(req.method)) {
      res.status(405).json({ error: `Method ${req.method} not allowed` });
      return;
    }
    try {
      const token = await auth.getToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const ct = req.headers["content-type"];
      if (ct) headers["Content-Type"] = String(ct);
      const accept = req.headers.accept;
      if (accept) headers.Accept = String(accept);

      let body: Buffer | undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        // express.json() may have parsed it; reserialize.
        if (req.body && Object.keys(req.body).length > 0) {
          body = Buffer.from(JSON.stringify(req.body));
        }
      }

      const upstream = await fetch(`${UPSTREAM}${req.url}`, {
        method: req.method,
        headers,
        body,
      });

      res.status(upstream.status);
      const respCt = upstream.headers.get("content-type");
      if (respCt) res.setHeader("Content-Type", respCt);

      if (upstream.body) {
        Readable.fromWeb(
          upstream.body as Parameters<typeof Readable.fromWeb>[0],
        ).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: msg });
    }
  });

  app.use("/swagger-ui", express.static(swaggerUiDist.getAbsoluteFSPath()));

  // --- Root: login or Swagger based on auth state --------------------------

  app.get("/", (_req, res) => {
    if (auth.hasCredentials()) {
      res.type("html").send(SWAGGER_HTML);
    } else {
      res.type("html").send(loginHtml());
    }
  });

  const HOST = "localhost";
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, HOST, () => {
      console.log(`Cyvl API Explorer ready at http://${HOST}:${port}`);
      resolve();
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Set PORT=<other> or stop the other process.`,
          ),
        );
      } else {
        reject(err);
      }
    });
  });
}
