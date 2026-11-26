import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { test as base } from "playwright-bdd";
import { Sandbox, type Account } from "./sandbox";
import { assertSafeTarget } from "./testEnv";

/** Gives each local browser its own auth-rate bucket, e.g. a reserved 2001:db8:: client; staging is never spoofed. */
export async function installLocalAuthClient(context: BrowserContext, baseURL: string) {
  const origin = new URL(assertSafeTarget(baseURL));
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) return;
  // Non-login auth actions are IP-limited, so unique emails alone cannot isolate parallel signup/reset tests.
  const groups = randomUUID().replaceAll("-", "").slice(0, 24).match(/.{4}/g)!;
  const clientIp = `2001:db8:${groups.join(":")}`;
  await context.route(
    url => url.origin === origin.origin && url.pathname.startsWith("/api/store/auth/"),
    /** Changes only the simulated local client identity; the actual request and rate-limit checks still run. */
    async route => {
      await route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": clientIp, "x-real-ip": clientIp } });
    },
  );
}

/** Mirrors NextAuth's real CSRF login, then checks the session belongs to the exact disposable account. */
export async function authenticate(request: APIRequestContext, account: Account) {
  const csrf = await request.get("/api/auth/csrf");
  expect(csrf.status()).toBe(200);
  const { csrfToken } = await csrf.json();
  expect(csrfToken).toBeTruthy();
  const login = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: account.email, password: account.password, callbackUrl: "/products", json: "true" },
  });
  expect(login.ok()).toBeTruthy();
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(200);
  const session = await response.json();
  expect(session.user.email).toBe(account.email);
  expect(Number(session.user.id)).toBe(account.id);
}

export const test = base.extend<{ sandbox: Sandbox; account: Account }>({
  /** Isolates local auth requests before any UI navigation; cookies and DB fixtures remain per scenario. */
  context: async ({ context, baseURL }, provide) => {
    await installLocalAuthClient(context, baseURL!);
    await provide(context);
  },
  /** Always cleans fixtures, including when a UI assertion, mail lookup, or payment fails. */
  sandbox: async ({ baseURL }, provide) => {
    const sandbox = await Sandbox.open(baseURL!);
    try { await provide(sandbox); } finally { await sandbox.cleanup(); }
  },
  /** Provides a fresh verified user for each test; the configured personal/shared login is never modified. */
  account: async ({ sandbox }, provide) => { await provide(await sandbox.account()); },
});

export { expect };
