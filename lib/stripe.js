import Stripe from "stripe";

let stripe;

/**
 * Exported (unlike lib/email.js's private client()) because lib/billing.js
 * needs direct access to several distinct Stripe API surfaces — checkout
 * sessions, billing portal sessions, webhook signature verification — not
 * just a handful of wrapper send calls the way Resend's usage is.
 */
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing is not configured.");
  }
  stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}
