// NextAuth API route
//
// This file defines the NextAuth server endpoint at:
//   /api/auth/*
//
// IMPORTANT:
// - This code runs on the Next.js server (Node.js or serverless),
//   NOT in the browser.
// - Catalog, account and payment routes all share this Next.js server.
//
// Request flow:
// Browser -> /api/auth/* (NextAuth server)
//                     -> authorize() (in lib/auth.ts)
//                     -> loginAccount() -> PostgreSQL (no loopback HTTP)
//
// NextAuth handles sessions, cookies, and callbacks here.


import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
