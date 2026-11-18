import { runStoreApi } from "@/lib/server/storeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ path: string[] }> };

/** Serves catalog, shipping and verification reads, e.g. GET /api/store/products/13. */
export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return runStoreApi({ method: "GET", path, searchParams: new URL(request.url).searchParams, headers: request.headers });
}

/** Serves account actions, e.g. POST /api/store/auth/signup with JSON credentials. */
export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  return runStoreApi({ method: "POST", path, body: body as Record<string, unknown>, headers: request.headers });
}
