import { readFile, writeFile } from "node:fs/promises";

export const SUPABASE_URL = "https://rdrfkzjkcxgdsokervcr.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcmZremprY3hnZHNva2VydmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDk0NTYsImV4cCI6MjA2MDgyNTQ1Nn0.561dFyOYPHjv2TGNj5wEnm1rOokBnrAN9qMf1ukiv18";
const TOKEN_EXCHANGE_URL = "https://cyvl.app/auth/v1/oauth2/token";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_EXPIRES_MS = 55 * 60 * 1000;

export interface CyvlAuthOptions {
  email?: string;
  password?: string;
  refreshToken?: string;
  envPath: string;
}

interface SupabaseTokenResp {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  expiresAt?: number;
}

export class CyvlAuth {
  private token: string | null = null;
  private expiresAt: number | null = null;
  private email: string | undefined;
  private password: string | undefined;
  private refreshToken: string | null;
  private envPath: string;

  constructor(opts: CyvlAuthOptions) {
    this.email = opts.email;
    this.password = opts.password;
    this.refreshToken = opts.refreshToken ?? null;
    this.envPath = opts.envPath;
  }

  hasCredentials(): boolean {
    return !!this.refreshToken || (!!this.email && !!this.password);
  }

  isAuthenticated(): boolean {
    return (
      !!this.token &&
      this.expiresAt !== null &&
      Date.now() < this.expiresAt - REFRESH_MARGIN_MS
    );
  }

  status(): AuthStatus {
    return {
      authenticated: this.isAuthenticated(),
      email: this.email,
      expiresAt: this.expiresAt ?? undefined,
    };
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    this.email = email;
    this.password = password;
    this.refreshToken = null;
    this.token = null;
    this.expiresAt = null;
    await this.authenticate();
  }

  async signInWithRefreshToken(refreshToken: string): Promise<void> {
    this.refreshToken = refreshToken;
    this.token = null;
    this.expiresAt = null;
    await this.authenticate();
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    const needsRefresh =
      !this.token ||
      this.expiresAt === null ||
      now >= this.expiresAt - REFRESH_MARGIN_MS;
    if (needsRefresh) {
      await this.authenticate();
    }
    if (!this.token) {
      throw new Error("[auth] Token missing after authenticate()");
    }
    return this.token;
  }

  private async authenticate(): Promise<void> {
    const supa = await this.getSupabaseSession();

    if (supa.refreshToken && supa.refreshToken !== this.refreshToken) {
      this.refreshToken = supa.refreshToken;
      try {
        await persistRefreshToken(this.envPath, supa.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[auth] Could not persist refresh token to .env: ${msg}`);
      }
    }

    const form = new URLSearchParams();
    form.set("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
    form.set(
      "subject_token_type",
      "urn:ietf:params:oauth:token-type:access_token",
    );
    form.set("subject_token", supa.accessToken);

    const cyvlResp = await fetch(TOKEN_EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!cyvlResp.ok) {
      const body = await cyvlResp.text();
      throw new Error(
        `[auth] Cyvl token exchange failed (${cyvlResp.status}): ${body}`,
      );
    }
    const cyvlJson = (await cyvlResp.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!cyvlJson.access_token) {
      throw new Error(
        "[auth] Cyvl response missing access_token: " + JSON.stringify(cyvlJson),
      );
    }

    this.token = cyvlJson.access_token;
    const expiresInMs =
      typeof cyvlJson.expires_in === "number"
        ? cyvlJson.expires_in * 1000
        : DEFAULT_EXPIRES_MS;
    this.expiresAt = Date.now() + expiresInMs;

    // Extract email from JWT payload if we don't have it set
    if (!this.email) {
      try {
        const payload = JSON.parse(
          Buffer.from(this.token.split(".")[1], "base64url").toString(),
        ) as { email?: string };
        if (payload.email) this.email = payload.email;
      } catch {
        // ignore
      }
    }

    const minutes = Math.round(expiresInMs / 60000);
    const who = this.email ?? "(unknown user)";
    console.log(
      `[auth] Authenticated as ${who}, token valid for ${minutes} minutes`,
    );
  }

  private async getSupabaseSession(): Promise<SupabaseTokenResp> {
    if (this.refreshToken) {
      try {
        return await this.refreshGrant(this.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (this.email && this.password) {
          console.warn(
            `[auth] Refresh token failed, falling back to password: ${msg}`,
          );
          return await this.passwordGrant(this.email, this.password);
        }
        throw new Error(
          `[auth] Refresh token failed and no password fallback available: ${msg}`,
        );
      }
    }
    if (this.email && this.password) {
      return await this.passwordGrant(this.email, this.password);
    }
    throw new Error("[auth] No credentials configured.");
  }

  private async passwordGrant(
    email: string,
    password: string,
  ): Promise<SupabaseTokenResp> {
    const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `Supabase password grant failed (${resp.status}): ${body}`,
      );
    }
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!json.access_token) {
      throw new Error(
        "Supabase password response missing access_token: " +
          JSON.stringify(json),
      );
    }
    return { accessToken: json.access_token, refreshToken: json.refresh_token };
  }

  private async refreshGrant(refreshToken: string): Promise<SupabaseTokenResp> {
    const url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `Supabase refresh_token grant failed (${resp.status}): ${body}`,
      );
    }
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!json.access_token) {
      throw new Error(
        "Supabase refresh response missing access_token: " +
          JSON.stringify(json),
      );
    }
    return { accessToken: json.access_token, refreshToken: json.refresh_token };
  }
}

async function persistRefreshToken(
  envPath: string,
  newToken: string,
): Promise<void> {
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    await writeFile(envPath, `CYVL_REFRESH_TOKEN=${newToken}\n`);
    return;
  }
  const lines = content.split("\n");
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^CYVL_REFRESH_TOKEN=/.test(lines[i])) {
      lines[i] = `CYVL_REFRESH_TOKEN=${newToken}`;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    if (content && !content.endsWith("\n")) lines.push("");
    lines.push(`CYVL_REFRESH_TOKEN=${newToken}`);
  }
  await writeFile(envPath, lines.join("\n"));
}
