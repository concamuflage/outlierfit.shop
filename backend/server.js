require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");
const shippingRouter = require("./routes/shipping");
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const authRateLimitStore = new Map();

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 10;

function getClientIdentifier(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function authRateLimiter(req, res, next) {
  const key = `${req.path}:${getClientIdentifier(req)}`;
  const now = Date.now();
  const existingEntry = authRateLimitStore.get(key);

  if (!existingEntry || now > existingEntry.resetAt) {
    authRateLimitStore.set(key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (existingEntry.count >= AUTH_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((existingEntry.resetAt - now) / 1000);
    res.set("Retry-After", String(Math.max(retryAfterSeconds, 1)));
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  existingEntry.count += 1;
  authRateLimitStore.set(key, existingEntry);
  return next();
}

// Only requests coming from a page loaded at CLIENT_ORIGIN(the frontend)
// are allowed to read the response in the browser.
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// The paths

app.use("/products", productsRouter);
app.use("/shipping", shippingRouter);
app.use("/auth", authRateLimiter, authRouter);

const PORT = process.env.PORT;
const HOST = process.env.HOST;
app.listen(PORT, () => {
  console.log(`Backend running on ${HOST}:${PORT}`);
});
