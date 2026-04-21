// Next.js middleware entry point.
// This file can intercept requests to apply auth checks, redirects, or rewrites.
export { default } from "next-auth/middleware";

// The matcher controls which routes are protected by NextAuth middleware.
// Empty array means no routes are currently protected.
// Example: matcher: ["/cart"] would require login for /cart.
export const config = {
  matcher: ["/cart", "/profile"],
};
