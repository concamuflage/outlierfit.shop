import * as products from "@/backend/controllers/productsController";
import * as auth from "@/backend/controllers/authController";

type StoreApiInput = {
  method: string;
  path: string[];
  body?: Record<string, unknown>;
  searchParams?: URLSearchParams;
  headers?: Headers;
};

type RateLimitEntry = { count: number; resetAt: number };
const runtime = globalThis as typeof globalThis & { outlierfitAuthRateLimits?: Map<string, RateLimitEntry> };
const authRateLimits = runtime.outlierfitAuthRateLimits ??= new Map<string, RateLimitEntry>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

/** Builds the existing per-action/email/IP limiter key, e.g. login:test@example.com:127.0.0.1. */
function rateLimitKey(action: string, body: Record<string, unknown>, headers?: Headers) {
  const email = action === "login" && typeof body.email === "string" ? body.email.trim().toLowerCase() : "no-email";
  const ip = headers?.get("x-forwarded-for")?.split(",")[0].trim() || headers?.get("x-real-ip") || "unknown";
  return `${action}:${email || "no-email"}:${ip}`;
}

/** Keeps the original ten-attempt window; attempt eleven returns 429 with Retry-After. */
function checkAuthRateLimit(key: string): Response | null {
  const now = Date.now();
  for (const [storedKey, entry] of authRateLimits) {
    if (now > entry.resetAt) authRateLimits.delete(storedKey);
  }
  const entry = authRateLimits.get(key);
  if (!entry) {
    authRateLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (entry.count >= MAX_REQUESTS) {
    return Response.json({ error: "Too many attempts. Please try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(Math.ceil((entry.resetAt - now) / 1000), 1)) },
    });
  }
  entry.count += 1;
  return null;
}

/** Dispatches same-process requests, e.g. GET /api/store/products, without Express or another port. */
export async function runStoreApi({ method, path, body = {}, searchParams, headers }: StoreApiInput): Promise<Response> {
  try {
    if (path[0] === "products" && method === "GET") {
      if (path.length === 1) return await products.getAllProducts();
      if (path.length === 3 && path[1] === "styles") {
        return await products.getProductsByStyleName({ params: { styleName: path[2] } });
      }
      if (path.length === 2) return await products.getProductById({ params: { id: path[1] } });
    }

    if (path[0] === "auth" && path.length === 2) {
      const action = path[1];
      const handlers = {
        signup: auth.signup,
        login: auth.login,
        "verify-email": auth.verifyEmail,
        "resend-verification": auth.resendVerification,
        "request-password-reset": auth.requestPasswordReset,
        "reset-password": auth.resetPassword,
      };
      if (!Object.hasOwn(handlers, action)) return Response.json({ error: "Not found" }, { status: 404 });
      const expectedMethod = action === "verify-email" ? "GET" : "POST";
      if (method !== expectedMethod) {
        return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: expectedMethod } });
      }
      const key = rateLimitKey(action, body, headers);
      const limited = checkAuthRateLimit(key);
      if (limited) return limited;
      const handler = handlers[action as keyof typeof handlers];
      return await handler({
        body,
        query: Object.fromEntries(searchParams ?? []),
        // Successful login clears precisely the bucket that admitted this request.
        clearAuthRateLimit: () => authRateLimits.delete(key),
      });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("store API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Authenticates server-side without HTTP; e.g. NextAuth checks a verified account in the same process. */
export async function loginAccount(email: string, password: string, headers?: Headers) {
  return runStoreApi({ method: "POST", path: ["auth", "login"], body: { email, password }, headers });
}
