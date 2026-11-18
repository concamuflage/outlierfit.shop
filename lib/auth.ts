import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { loginAccount } from "@/lib/server/storeApi";
import { isUserEmailVerified } from "@/lib/server/authUserStore";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /** Checks credentials inside Next; an unverified account receives the existing verification error. */
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const response = await loginAccount(
          credentials.email,
          credentials.password,
          new Headers(request.headers as Record<string, string>)
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || "Invalid email or password.");
        }
        if (!payload?.id || !payload?.email) return null;
        if (payload.emailVerified === false) {
          throw new Error("Please verify your email before signing in.");
        }
        return {
          id: String(payload.id),
          email: payload.email,
          name: [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || payload.email,
          verifiedEmail: true,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    /** Revalidates account status on session access; deleting a user invalidates their verified session. */
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.verifiedEmail = user.verifiedEmail === true;
      }
      if (typeof token.userId === "string") {
        try {
          token.verifiedEmail = await isUserEmailVerified(token.userId);
        } catch (error) {
          console.error("email verification session check error:", error);
          token.verifiedEmail = false;
        }
      }
      return token;
    },
    /** Exposes the verified user ID, e.g. token.userId "60" becomes session.user.id "60". */
    async session({ session, token }) {
      if (token.verifiedEmail === false) return { ...session, user: undefined };
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
  pages: { signIn: "/login" },
};
