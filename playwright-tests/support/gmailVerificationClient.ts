import { fetch, Agent, ProxyAgent } from "undici";
import { envValue, requiredEnvValue } from "./testEnv";

type Part = { filename?: string; body?: { data?: string }; parts?: Part[] };
type Message = { id: string; internalDate?: string; payload?: Part & { headers?: { name: string; value: string }[] } };
export type MailKind = "verification" | "reset" | "invoice";
export type DeliveredMail = { link: string; from: string; body: string; attachments: string[] };
const subjects = { verification: "Verify your OutlierFit account", reset: "Reset your OutlierFit password", invoice: "Your OutlierFit invoice" };
const patterns = {
  verification: /https?:\/\/[^\s"'<>]+\/verify-email\?[^\s"'<>]+/g,
  reset: /https?:\/\/[^\s"'<>]+\/reset-password\?[^\s"'<>]+/g,
  invoice: /https?:\/\/[^\s"'<>]+\/api\/profile\/orders\/\d+\/invoice\/pdf(?:\?[^\s"'<>]*)?/g,
};
const dispatchers = new Map<string, Agent | ProxyAgent>();
let cached: { value: string; until: number } | undefined;

/** Matches NO_PROXY host/port rules, e.g. .googleapis.com bypasses the proxy for gmail.googleapis.com. */
function bypassProxy(url: URL) {
  const entries = envValue("NO_PROXY") ?? envValue("no_proxy", "")!;
  const port = Number(url.port) || (url.protocol === "https:" ? 443 : 80);
  return entries.toLowerCase().split(/[,\s]+/).some(entry => {
    if (entry === "*") return true;
    if (!entry) return false;
    const match = entry.match(/^(.+):(\d+)$/);
    if (match && Number(match[2]) !== port) return false;
    const host = match ? match[1] : entry;
    return /^[.*]/.test(host)
      ? url.hostname.endsWith(host.replace(/^\*/, ""))
      : url.hostname === host;
  });
}

/** Reuses stable dispatchers; e.g. HTTPS_PROXY routes Google requests while NO_PROXY=* uses a direct Agent. */
function mailDispatcher(value: string) {
  const url = new URL(value);
  const httpProxy = envValue("HTTP_PROXY") ?? envValue("http_proxy");
  const httpsProxy = envValue("HTTPS_PROXY") ?? envValue("https_proxy");
  const proxy = bypassProxy(url) ? "" : (url.protocol === "https:" ? httpsProxy || httpProxy : httpProxy) || "";
  let dispatcher = dispatchers.get(proxy);
  if (!dispatcher) {
    dispatcher = proxy ? new ProxyAgent(proxy) : new Agent();
    dispatchers.set(proxy, dispatcher);
  }
  return dispatcher;
}

/** Decodes MIME body parts recursively, including inline HTML and attachment filenames. */
function parts(part: Part | undefined, text: string[], attachments: string[]) {
  if (part?.filename) attachments.push(part.filename);
  if (part?.body?.data) text.push(Buffer.from(part.body.data, "base64url").toString("utf8"));
  for (const child of part?.parts ?? []) parts(child, text, attachments);
}

/** Refreshes OAuth rather than trusting a stale configured access token; never logs provider payloads. */
async function accessToken(force = false) {
  if (!force && cached && cached.until > Date.now()) return cached.value;
  const refresh = envValue("GMAIL_REFRESH_TOKEN");
  if (!refresh) return requiredEnvValue("GMAIL_ACCESS_TOKEN");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", dispatcher: mailDispatcher("https://oauth2.googleapis.com/token"), signal: AbortSignal.timeout(20000),
    body: new URLSearchParams({ client_id: requiredEnvValue("GOOGLE_CLIENT_ID"), client_secret: requiredEnvValue("GOOGLE_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status}); update the Gmail test credential.`);
  const payload = await response.json() as { access_token: string; expires_in: number };
  if (!payload.access_token) throw new Error("Google returned no access token.");
  cached = { value: payload.access_token, until: Date.now() + (payload.expires_in - 60) * 1000 };
  return cached.value;
}

/** Fetches Gmail metadata with one 401 refresh, without putting recipient links or credentials in errors. */
async function gmail<T>(path: string): Promise<T> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, {
      dispatcher: mailDispatcher(url), headers: { Authorization: `Bearer ${await accessToken(attempt > 0)}` }, signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) throw new Error(`Gmail lookup failed (${response.status}).`);
    return await response.json() as T;
  }
  throw new Error("Gmail authentication failed.");
}

/** Polls for fresh mail and excludes superseded links, e.g. resend must not select the original token sent one second earlier. */
export async function findMail(email: string, kind: MailKind, after = Date.now(), excludedLinks: readonly string[] = []): Promise<DeliveredMail> {
  const until = Date.now() + Number(envValue("GMAIL_POLL_TIMEOUT_MS", "120000"));
  const query = `to:${email} subject:"${subjects[kind]}" newer_than:1d`;
  do {
    const list = await gmail<{ messages?: { id: string }[] }>(`messages?maxResults=20&includeSpamTrash=true&q=${encodeURIComponent(query)}`);
    for (const summary of list.messages ?? []) {
      const message = await gmail<Message>(`messages/${summary.id}?format=full`);
      if (Number(message.internalDate) < after - 2000) continue;
      const bodyParts: string[] = [], attachments: string[] = [];
      parts(message.payload, bodyParts, attachments);
      const body = bodyParts.join("\n").replaceAll("&amp;", "&").replaceAll("&#38;", "&");
      const link = [...body.matchAll(patterns[kind])][0]?.[0];
      if (link && !excludedLinks.includes(link)) return { link, body, attachments, from: message.payload?.headers?.find(h => h.name.toLowerCase() === "from")?.value ?? "" };
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  } while (Date.now() < until);
  throw new Error(`No fresh ${kind} email arrived within the configured polling timeout.`);
}

/** Preserves the existing helper API for external callers while using bounded polling. */
export async function findLatestVerificationEmail(email: string) {
  const mail = await findMail(email, "verification", Date.now() - 120000);
  return { verificationLink: mail.link, from: mail.from };
}
