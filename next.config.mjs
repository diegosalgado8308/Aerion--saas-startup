import { withSentryConfig } from "@sentry/nextjs";

// Embedded application-level firewall: response headers that constrain what
// a browser will do with this app's pages even if some other layer fails —
// no external script/frame/image sources, no framing by other sites, no
// MIME-sniffing. 'unsafe-inline' stays in script-src because Next.js injects
// its own inline hydration payload on every page (a nonce-based CSP would
// remove it, but requires generating a per-request nonce in proxy.js and
// threading it through every page — real complexity for an app with no
// dangerouslySetInnerHTML anywhere, i.e. no stored-XSS surface for a
// stricter script-src to actually be defending against). Revisit if that
// changes.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  // The three ingest.*.sentry.io patterns are deliberate, not redundant: Sentry's
  // ingest host is region-specific (o<org>.ingest.us.sentry.io / .de.sentry.io /
  // legacy .ingest.sentry.io) and CSP wildcards only match one label, so a plain
  // "*.sentry.io" silently fails to match the four-level "o123.ingest.us.sentry.io"
  // and the SDK drops every event with no visible error. Harmless if Sentry is
  // never configured — an unset DSN means the SDK never calls out to any of these.
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Matches MAX_ATTACHMENT_BYTES in lib/blob.js — keep both in sync.
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Uploads source maps so Sentry shows real stack traces instead of minified
// Turbopack output — safe to add now that SENTRY_ORG/SENTRY_PROJECT/
// SENTRY_AUTH_TOKEN are real values from the Vercel Sentry marketplace
// integration (not guessed), which is also why this was deliberately left
// out when Sentry was first wired up: an invalid/missing token here can
// hard-fail the whole build depending on plugin version, and there was
// nothing but placeholders to give it at the time.
//
// useRunAfterProductionCompileHook is documented as defaulting to true
// under Turbopack (uploading maps via a post-build hook rather than a
// webpack loader, since Turbopack doesn't run webpack loaders at all) —
// but that auto-detection didn't fire correctly in Vercel's actual build
// environment: the build crashed *during* compilation trying to resolve
// valueInjectionLoader.js, a webpack-only loader file, even though
// versions otherwise meet Sentry's stated Turbopack minimums
// (@sentry/nextjs >= 9.9.0, this app on 10.x; Next.js >= 15.3.0-canary.8,
// this app on 16.3.0 stable). Setting it explicitly forces the correct
// post-build-hook path instead of relying on that detection.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  useRunAfterProductionCompileHook: true,
});
