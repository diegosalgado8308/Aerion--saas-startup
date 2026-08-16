import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_SENTRY_DSN is not a secret — Sentry DSNs are meant to be
// public (they only identify where to send events, they grant no read
// access). Using the NEXT_PUBLIC_ prefix lets the same value cover the
// client bundle, this server config, and sentry.edge.config.js with one
// env var. Sentry.init() with an unset dsn is a documented no-op — the
// SDK disables itself instead of throwing — so this is safe to run
// unconditionally, including in local dev before a Sentry project exists.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
