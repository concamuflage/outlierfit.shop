// Base URL used as fallback when no valid environment URL is provided in production
const PRODUCTION_APP_BASE_URL = "https://outlierfit.shop";
// Store email that will also receive a copy of the invoice email
const STORE_EMAIL = "unodostreszlm@gmail.com";

// Normalizes a base URL by trimming whitespace and removing trailing slashes
function normalizeAppBaseUrl(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\/+$/, "") : "";
}

// Checks whether a given URL points to a localhost environment
function isLocalhostUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

// Determines the base URL for invoice links based on environment variables
// In production: prefers non-localhost URLs, falls back to a constant
// In development: uses the first available URL or localhost
function getInvoiceAppBaseUrl() {
  const fallbackUrls = [
    normalizeAppBaseUrl(process.env.APP_URL),
    normalizeAppBaseUrl(process.env.NEXTAUTH_URL),
    normalizeAppBaseUrl(process.env.CLIENT_ORIGIN),
  ].filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    return fallbackUrls.find((url) => !isLocalhostUrl(url)) || PRODUCTION_APP_BASE_URL;
  }

  return fallbackUrls[0] || "http://localhost:3000";
}

// Builds the full URL for downloading an invoice PDF for a given order
export function buildInvoicePdfLink(orderId: number) {
  return `${getInvoiceAppBaseUrl()}/api/profile/orders/${encodeURIComponent(String(orderId))}/invoice/pdf`;
}

// Sends an email containing the invoice download link using Resend API
// Includes both the customer and store email as recipients
export async function sendInvoiceLinkEmail({
  to,
  orderId,
  invoiceNumber,
  paidAt,
}: {
  to: string;
  orderId: number;
  invoiceNumber: string;
  paidAt: string;
}) {
  // Read required configuration from environment variables
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Missing Resend configuration. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  // Generate invoice download link
  const invoiceLink = buildInvoicePdfLink(orderId);
  // Ensure unique recipient list (customer + store email)
  const recipients = Array.from(new Set([to, STORE_EMAIL].map((email) => email.trim()).filter(Boolean)));
  // Format payment date for display in email
  const paidDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(paidAt));

  // Send email request to Resend API
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Your OutlierFit invoice ${invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <p>Thank you for your payment.</p>
          <p>Your order was paid on ${paidDate}. Your invoice is ready to download.</p>
          <p>
            <a
              href="${invoiceLink}"
              style="display:inline-block;padding:12px 20px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:9999px;"
            >
              Download invoice
            </a>
          </p>
          <p>If the button does not work, please copy and paste the following link into your browser:</p>
          <p><a href="${invoiceLink}">${invoiceLink}</a></p>
        </div>
      `,
      text:
        `Thank you for your payment.\n\n` +
        `Your order was paid on ${paidDate}. Your invoice is ready to download.\n\n` +
        `Download invoice:\n\n` +
        `${invoiceLink}\n`,
    }),
  });

  // Handle non-successful responses from Resend API
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Resend request failed with status ${response.status}. ${payload}`.trim());
  }
}
