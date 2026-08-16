import * as Sentry from "@sentry/nextjs";

// See sentry.server.config.js for why an unset dsn is safe here. Deliberately
// no replayIntegration()/session replay: this app handles real customer
// workspace data (task titles, comments, attachments), and replay records
// on-screen content — a heavier privacy tradeoff than plain error capture,
// not something to turn on by default without a deliberate decision.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});

// Sentry's own build-time warning asks for this: without it, App Router
// client-side navigations aren't linked into the same trace as the request
// that rendered the page, so a slow/broken navigation shows up disconnected
// from its cause in the dashboard instead of as one continuous trace.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
