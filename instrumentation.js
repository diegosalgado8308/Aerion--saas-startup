import * as Sentry from "@sentry/nextjs";

// Next's instrumentation convention: register() runs once per server
// instance, before it accepts requests, and is the supported place to load
// runtime-specific config (Node here talks to Prisma/bcrypt; edge — proxy.js
// — can't). See ARCHITECTURE.md's NextAuth section for the same node/edge
// split applied to auth config.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Catches errors Next's own error boundaries see but a component-level
// try/catch wouldn't: thrown Server Component render errors, Route Handler
// errors, Server Action errors, and proxy.js errors.
export const onRequestError = Sentry.captureRequestError;
