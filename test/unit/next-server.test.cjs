const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

// One root file is consulted; system environment overrides it without reading any legacy paths.
test("server environment reads only root .env.local with process overrides", () => {
  const key = "OUTLIERFIT_ENV_UNIT_VALUE";
  const original = process.env[key];
  delete process.env[key];
  try {
    const env = load("backend/env.js", { "node:fs": {
      existsSync: filename => { assert.equal(filename, path.resolve(".env.local")); return true; },
      readFileSync: () => Buffer.from(`${key}=root-value\n`),
    } });
    assert.equal(env.getServerEnv(key), "root-value");
    process.env[key] = "process-value";
    assert.equal(env.getServerEnv(key), "process-value");
  } finally {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

/** Loads a server module in isolation, e.g. replaces PostgreSQL and Resend with in-memory test doubles. */
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "../..", relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  /** Resolves an explicit test double first, e.g. ../database/pool never opens a live connection. */
  loaded.require = function dependency(id) {
    return Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(this, id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

/** Covers Gmail indexing races: the original token still qualifies by time, but resend must choose its replacement. */
test("verification resend lookup skips an invalidated original link", async () => {
  const after = Date.now();
  const original = "http://localhost:3000/verify-email?email=unit%40example.invalid&token=original";
  const replacement = "http://localhost:3000/verify-email?email=unit%40example.invalid&token=replacement";
  /** Satisfies dispatcher construction without sockets, proxy configuration, or real Google requests. */
  class OfflineDispatcher {}
  const mail = load("playwright-tests/support/gmailVerificationClient.ts", {
    undici: {
      Agent: OfflineDispatcher,
      ProxyAgent: OfflineDispatcher,
      /** Returns the original message first even though the replacement exists, matching a stale Gmail listing. */
      fetch: async url => {
        const pathname = new URL(url).pathname;
        if (pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "old" }, { id: "new" }] });
        const isOriginal = pathname.endsWith("/old");
        return Response.json({
          // The original is deliberately inside the lookup's two-second clock tolerance.
          internalDate: String(after + (isOriginal ? -500 : 100)),
          payload: { body: { data: Buffer.from(isOriginal ? original : replacement).toString("base64url") } },
        });
      },
    },
    "./testEnv": {
      /** Uses helper defaults only, without reading the developer's env file or credentials. */
      envValue: (_key, fallback) => fallback,
      /** Supplies a fake access token that is only passed to the in-memory fetch above. */
      requiredEnvValue: () => "unit-access-token",
    },
  });
  assert.equal((await mail.findMail("unit@example.invalid", "verification", after)).link, original);
  assert.equal((await mail.findMail("unit@example.invalid", "verification", after, [original])).link, replacement);
});

/** Keeps configured local/staging/production links on their own server, including local NODE_ENV=production builds. */
test("email and invoice links honor explicit APP_URL in every build mode", () => {
  const original = process.env.NODE_ENV;
  try {
    for (const mode of ["production", "development"]) {
      process.env.NODE_ENV = mode;
      for (const origin of ["http://localhost:3000", "https://staging.outlierfit.shop", "https://outlierfit.shop"]) {
        const settings = { APP_URL: `${origin}/` };
        /** Supplies only synthetic origins; no root env credentials, email transport, or network is used. */
        const getServerEnv = key => settings[key];
        const verification = load("backend/services/emailVerification.js", { "../env": { getServerEnv } });
        const reset = load("backend/services/passwordReset.js", { "../env": { getServerEnv } });
        const invoice = load("lib/server/invoiceEmail.ts", { "@/backend/env": { getServerEnv } });
        assert.equal(new URL(verification.buildVerificationLink("unit@example.invalid", "unit-token")).origin, origin);
        assert.equal(new URL(reset.buildPasswordResetLink("unit@example.invalid", "unit-token")).origin, origin);
        assert.equal(invoice.buildInvoicePdfLink(1), `${origin}/api/profile/orders/1/invoice/pdf`);
      }
    }
    const settings = {
      APP_URL: "http://localhost:3000",
      EMAIL_VERIFICATION_APP_URL: "http://localhost:3100",
      PASSWORD_RESET_APP_URL: "http://localhost:3200",
    };
    /** Preserves service-specific overrides, e.g. reset mail may explicitly target localhost:3200. */
    const getServerEnv = key => settings[key];
    const verification = load("backend/services/emailVerification.js", { "../env": { getServerEnv } });
    const reset = load("backend/services/passwordReset.js", { "../env": { getServerEnv } });
    assert.equal(new URL(verification.buildVerificationLink("unit@example.invalid", "unit-token")).origin, "http://localhost:3100");
    assert.equal(new URL(reset.buildPasswordResetLink("unit@example.invalid", "unit-token")).origin, "http://localhost:3200");
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

/** Builds dispatch fixtures; e.g. a verified login clears the existing rate-limit bucket. */
function dispatcher() {
  return load("lib/server/storeApi.ts", {
    "@/backend/controllers/productsController": {
      getAllProducts: async () => Response.json([{ product_id: 13, name: "Cotton Shirt" }]),
      getProductById: async req => Response.json({ product_id: req.params.id }),
      getProductsByStyleName: async req => Response.json({ style: req.params.styleName }),
    },
    "@/backend/controllers/authController": {
      signup: async () => Response.json({}, { status: 201 }),
      /** Mimics the login contract; only the synthetic password "test-success" succeeds. */
      login: async req => {
        if (req.body.password !== "test-success") return Response.json({ error: "Invalid credentials" }, { status: 401 });
        req.clearAuthRateLimit();
        return Response.json({ id: 1, email: req.body.email, emailVerified: true });
      },
      verifyEmail: async req => Response.json({ email: req.query.email }),
      resendVerification: async () => Response.json({}),
      requestPasswordReset: async () => Response.json({}),
      resetPassword: async () => Response.json({}),
    },
  });
}

// Exercise the path/parameter contract without requiring either Express or HTTP.
test("Next dispatcher routes catalog and verification, and retires shipping rates", async () => {
  const { runStoreApi } = dispatcher();
  const catalog = await runStoreApi({ method: "GET", path: ["products"] });
  assert.equal((await catalog.json())[0].name, "Cotton Shirt");
  const style = await runStoreApi({ method: "GET", path: ["products", "styles", "Shirts"] });
  assert.equal((await style.json()).style, "Shirts");
  const item = await runStoreApi({ method: "GET", path: ["products", "13"] });
  assert.equal((await item.json()).product_id, "13");
  assert.equal((await runStoreApi({ method: "GET", path: ["shipping", "costs"] })).status, 404);
  const verified = await runStoreApi({ method: "GET", path: ["auth", "verify-email"], searchParams: new URLSearchParams({ email: "test@example.invalid" }) });
  assert.equal((await verified.json()).email, "test@example.invalid");
  assert.equal((await runStoreApi({ method: "GET", path: ["auth", "toString"] })).status, 404);
  assert.equal((await runStoreApi({ method: "GET", path: ["auth", "signup"] })).status, 405);
});

// Match the former Express limiter: ten failures admitted, then 429; successful login resets its bucket.
test("same-process login preserves throttling and clears the bucket on success", async () => {
  const { loginAccount } = dispatcher();
  const headers = new Headers({ "x-forwarded-for": "unit-rate-limit" });
  for (let n = 0; n < 10; n++) assert.equal((await loginAccount("rate@example.invalid", "wrong", headers)).status, 401);
  const limited = await loginAccount("rate@example.invalid", "wrong", headers);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  for (let n = 0; n < 9; n++) assert.equal((await loginAccount("success@example.invalid", "wrong", headers)).status, 401);
  assert.equal((await loginAccount("success@example.invalid", "test-success", headers)).status, 200);
  assert.equal((await loginAccount("success@example.invalid", "wrong", headers)).status, 401);
});

/** Loads actual account handlers using a query function and fake email transport; no messages leave the test. */
function accountHandlers(query, email = {}) {
  return load("backend/controllers/authController.js", {
    "../database/pool": { query },
    "../services/emailVerification": {
      createVerificationToken: () => ({ rawToken: "test-token", hashedToken: "test-hash", expiresAt: new Date(Date.now() + 60000) }),
      hashVerificationToken: () => "test-hash",
      buildVerificationLink: () => "http://localhost:3000/verify-email?token=test-token",
      sendVerificationEmail: async () => {}, ...email,
    },
    "../services/passwordReset": {
      createPasswordResetToken: () => ({ rawToken: "test-token", hashedToken: "test-hash", expiresAt: new Date(Date.now() + 60000) }),
      hashPasswordResetToken: () => "test-hash",
      buildPasswordResetLink: () => "http://localhost:3000/reset-password?token=test-token",
      sendPasswordResetEmail: async () => {},
    },
    bcryptjs: { hash: async () => "test-only-hash", compare: async password => password === "test-password" },
  });
}

// Native Response migration must retain existing signup, login, and token status codes.
test("account handlers preserve signup, verification, login and reset behavior", async () => {
  let verified = false;
  let verificationSent = false;
  const writes = [];
  /** Supplies a synthetic account; e.g. reset reads receive a non-expired hashed token. */
  async function query(sql) {
    if (/^\s*(CREATE|ALTER)/.test(sql)) return { rows: [] };
    if (/INSERT INTO users/.test(sql)) return { rows: [{ id: 1, email: "test@example.invalid", first_name: "Test" }] };
    if (/SELECT id, email, first_name, email_verified/.test(sql)) return { rows: [] };
    if (/SELECT/.test(sql)) return { rows: [{ id: 1, email: "test@example.invalid", email_verified: verified,
      password_hash: "test-only-hash", email_verification_token: "test-hash", password_reset_token: "test-hash",
      email_verification_expires: new Date(Date.now() + 60000), password_reset_expires: new Date(Date.now() + 60000) }] };
    writes.push(sql);
    return { rows: [] };
  }
  const auth = accountHandlers(query, { sendVerificationEmail: async () => { verificationSent = true; } });
  const signup = await auth.signup({ body: { email: "test@example.invalid", password: "Unit-test-only-123!", firstName: "Test", lastName: "User" } });
  assert.equal(signup.status, 201);
  assert.ok(verificationSent);
  assert.equal((await auth.login({ body: { email: "test@example.invalid", password: "wrong" } })).status, 401);
  assert.equal((await auth.login({ body: { email: "test@example.invalid", password: "test-password" } })).status, 403);
  const verification = await auth.verifyEmail({ query: { email: "test@example.invalid", token: "test-token" } });
  assert.equal(verification.status, 200);
  assert.ok(writes.some(sql => /email_verified = TRUE/.test(sql)));
  verified = true;
  let cleared = false;
  assert.equal((await auth.login({ body: { email: "test@example.invalid", password: "test-password" }, clearAuthRateLimit: () => { cleared = true; } })).status, 200);
  assert.ok(cleared);
  assert.equal((await auth.requestPasswordReset({ body: { email: "test@example.invalid" } })).status, 200);
  assert.equal((await auth.resetPassword({ body: { email: "test@example.invalid", token: "test-token", password: "Unit-test-only-123!" } })).status, 200);
  assert.ok(writes.some(sql => /SET password_hash/.test(sql)));
});

// Invalid token dates must remain rejected after removing Express.
test("expired verification and reset tokens are rejected", async () => {
  const auth = accountHandlers(async sql => ({ rows: /SELECT/.test(sql) ? [{ id: 1, email_verified: false,
    email_verification_token: "test-hash", password_reset_token: "test-hash",
    email_verification_expires: new Date(0), password_reset_expires: new Date(0) }] : [] }));
  assert.equal((await auth.verifyEmail({ query: { email: "test@example.invalid", token: "test-token" } })).status, 400);
  assert.equal((await auth.resetPassword({ body: { email: "test@example.invalid", token: "test-token", password: "Unit-test-only-123!" } })).status, 400);
});

// Next receives malformed JSON as 400, not a thrown handler exception or leaked stack trace.
test("Next POST route rejects invalid JSON and non-object payloads", async () => {
  let called = false;
  const route = load("app/api/store/[...path]/route.ts", { "@/lib/server/storeApi": { runStoreApi: async () => { called = true; return Response.json({}); } } });
  for (const body of ["not-json", "null", "[]"]) {
    const response = await route.POST(new Request("http://localhost:3000/api/store/auth/signup", { method: "POST", body }), { params: Promise.resolve({ path: ["auth", "signup"] }) });
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});
