import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";

const filename = path.resolve(__dirname, "../../.env.local");
const local = fs.existsSync(filename) ? parse(fs.readFileSync(filename)) : {};

/** Reads the root env file with process overrides, e.g. PGPORT=5433 supplied by CI wins. */
export function envValue(name: string, fallback?: string) {
  return process.env[name] || local[name] || fallback;
}

/** Requires a setting without logging its value, e.g. missing PGPASSWORD fails before fixture writes. */
export function requiredEnvValue(name: string) {
  const value = envValue(name);
  if (!value) throw new Error(`Missing required environment value: ${name}`);
  return value;
}

/** Blocks production and lookalike hosts; e.g. only localhost or the exact HTTPS staging hostname is allowed. */
export function assertSafeTarget(value: string) {
  const url = new URL(value);
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!localHost && !(url.hostname === "staging.outlierfit.shop" && url.protocol === "https:")) ||
      url.username || url.password || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("Tests may target only localhost or https://staging.outlierfit.shop, never production.");
  }
  return url.origin;
}

/** Rejects live or missing keys before payment actions, e.g. rk_live_* is never accepted on localhost. */
export function assertTestStripeKey(key: string) {
  if (!/^[sr]k_test_.+/.test(key)) throw new Error("Payment tests require a test-mode Stripe key; live keys are forbidden.");
  return key;
}

/** Returns the configured sender for delivered-mail assertions, e.g. a verified Resend sender address. */
export function expectedResendFromEmail() {
  return requiredEnvValue("RESEND_FROM_EMAIL");
}

/** Generates an owned alias, e.g. name+pw<UUID>@gmail.com, rather than reusing a personal account. */
export function generateGmailAlias(email = envValue("TEST_EMAIL_BASE", "concamuflage@gmail.com")!) {
  const [name, domain] = email.split("@");
  if (!name || domain?.toLowerCase() !== "gmail.com") throw new Error("TEST_EMAIL_BASE must be a Gmail address.");
  return `${name}+pw${randomUUID().replaceAll("-", "")}@${domain}`;
}
