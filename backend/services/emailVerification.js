const { getServerEnv } = require("../env");
const crypto = require("crypto");

const DEFAULT_VERIFICATION_TTL_HOURS = 24;
const PRODUCTION_APP_BASE_URL = "https://outlierfit.shop";

/** Reads the server-side verification TTL, e.g. 24 means links expire after one day. */
function getVerificationTtlHours() {
  const rawValue = Number(getServerEnv("EMAIL_VERIFICATION_TTL_HOURS") || DEFAULT_VERIFICATION_TTL_HOURS);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return DEFAULT_VERIFICATION_TTL_HOURS;
  }
  return rawValue;
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + getVerificationTtlHours() * 60 * 60 * 1000);

  return { rawToken, hashedToken, expiresAt };
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeAppBaseUrl(value) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\/+$/, "") : "";
}

function isLocalhostUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

/** Honors explicit origins even in a production build, e.g. APP_URL=http://localhost:3000 for local UI tests. */
function getVerificationAppBaseUrl() {
  const explicitEmailUrl = normalizeAppBaseUrl(getServerEnv("EMAIL_VERIFICATION_APP_URL"));
  if (explicitEmailUrl) return explicitEmailUrl;
  const explicitAppUrl = normalizeAppBaseUrl(getServerEnv("APP_URL"));
  if (explicitAppUrl) return explicitAppUrl;

  const fallbackUrls = [
    normalizeAppBaseUrl(getServerEnv("CLIENT_ORIGIN")),
    normalizeAppBaseUrl(getServerEnv("NEXTAUTH_URL")),
  ].filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    return fallbackUrls.find((url) => !isLocalhostUrl(url)) || PRODUCTION_APP_BASE_URL;
  }

  return fallbackUrls[0] || "http://localhost:3000";
}

function buildVerificationLink(email, rawToken) {
  const params = new URLSearchParams({
    email,
    token: rawToken,
  });

  return `${getVerificationAppBaseUrl()}/verify-email?${params.toString()}`;
}

/** Sends verification using Next/legacy Resend settings; a rejected API key still throws an error. */
async function sendVerificationEmail({ to, firstName, verificationLink }) {
  const apiKey = getServerEnv("RESEND_API_KEY");
  const from = getServerEnv("RESEND_FROM_EMAIL");

  if (!apiKey || !from) {
    throw new Error("Missing Resend configuration. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  const greetingName = typeof firstName === "string" && firstName.trim() ? firstName.trim() : "there";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your OutlierFit account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <p>Hi ${greetingName},</p>
          <p>Welcome to OutlierFit, and thank you for creating an account with us.</p>
          <p>To finish setting up your account, please verify your email address by clicking the button below.</p>
          <p>
            <a
              href="${verificationLink}"
              style="display:inline-block;padding:12px 20px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:9999px;"
            >
              Verify email
            </a>
          </p>
          <p>If the button does not work, please copy and paste the following link into your browser:</p>
          <p><a href="${verificationLink}">${verificationLink}</a></p>
        </div>
      `,
      text:
        `Hi ${greetingName},\n\n` +
        `Welcome to OutlierFit, and thank you for creating an account with us.\n\n` +
        `To finish setting up your account, please verify your email address by clicking the button below.\n\n` +
        `Verify email\n\n` +
        `If the button does not work, please copy and paste the following link into your browser:\n\n` +
        `${verificationLink}\n`,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Resend request failed with status ${response.status}. ${payload}`.trim());
  }
}

module.exports = {
  buildVerificationLink,
  createVerificationToken,
  hashVerificationToken,
  sendVerificationEmail,
};
