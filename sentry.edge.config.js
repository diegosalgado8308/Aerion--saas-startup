import * as Sentry from "@sentry/nextjs";

// Mirrors sentry.server.config.js — see that file for why an unset DSN is
// safe. Kept as a separate file (rather than reusing the server config)
// because the edge runtime can't load Node-only SDK internals; @sentry/nextjs
// resolves this file's imports against the edge-safe build instead.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
