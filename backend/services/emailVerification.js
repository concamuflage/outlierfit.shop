const crypto = require("crypto");

const DEFAULT_VERIFICATION_TTL_HOURS = 24;

function getVerificationTtlHours() {
  const rawValue = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || DEFAULT_VERIFICATION_TTL_HOURS);
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

function getVerificationAppBaseUrl() {
  return (
    process.env.EMAIL_VERIFICATION_APP_URL ||
    process.env.CLIENT_ORIGIN ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function buildVerificationLink(email, rawToken) {
  const params = new URLSearchParams({
    email,
    token: rawToken,
  });

  return `${getVerificationAppBaseUrl()}/verify-email?${params.toString()}`;
}

async function sendVerificationEmail({ to, firstName, verificationLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

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
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Verify your Asian Fit account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <p>Hi ${greetingName},</p>
          <p>Verify your email address to finish creating your Asian Fit account.</p>
          <p>
            <a
              href="${verificationLink}"
              style="display:inline-block;padding:12px 20px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:9999px;"
            >
              Verify email
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p><a href="${verificationLink}">${verificationLink}</a></p>
        </div>
      `,
      text:
        `Hi ${greetingName},\n\n` +
        `Verify your email address to finish creating your Asian Fit account.\n\n` +
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
