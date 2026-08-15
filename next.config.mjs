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
  "connect-src 'self'",
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

export default nextConfig;
