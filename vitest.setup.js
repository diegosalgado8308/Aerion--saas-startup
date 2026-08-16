import { config } from "dotenv";

// .env first (DATABASE_URL, AUTH_SECRET, ...), then .env.local on top with
// override — matches Next.js's own precedence. Plain `dotenv/config` only
// loads .env, which left anything a Vercel marketplace integration writes to
// .env.local (Sentry's vars, Stripe's STRIPE_PRICE_PRO/BUSINESS, ...)
// invisible to tests even though the running app has them via Next's loader.
config({ path: ".env" });
config({ path: ".env.local", override: true });
