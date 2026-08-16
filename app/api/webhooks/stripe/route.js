import { stripeClient } from "@/lib/stripe";
import { syncSubscriptionFromStripeEvent } from "@/lib/billing";

/**
 * No session — Stripe's webhook trigger has no user cookie, so this sits
 * outside proxy.js's auth gate entirely (excluded via config.matcher) and
 * verifies Stripe's own signature instead, the same pattern as
 * api/cron/task-reminders checking CRON_SECRET.
 */
export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  // App Router Route Handlers give raw text natively — no bodyParser config
  // needed, unlike stale Pages Router Stripe tutorials. Signature
  // verification needs this exact raw body, not a parsed/re-serialized one.
  const rawBody = await request.text();

  let event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Webhook signature verification failed.", { status: 400 });
  }

  try {
    await syncSubscriptionFromStripeEvent(event);
  } catch (err) {
    console.error("[stripe webhook] handler failed:", err);
    return new Response("Webhook handler error", { status: 500 }); // non-2xx so Stripe retries
  }

  return new Response(null, { status: 200 });
}
