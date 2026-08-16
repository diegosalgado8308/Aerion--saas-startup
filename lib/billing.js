import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { stripeClient } from "@/lib/stripe";

/**
 * Single source of truth for both enforcement (assert* below) and display
 * (the /pricing and /billing pages) — avoids a second parallel structure.
 * priceId is null for FREE (nothing to check out into).
 */
export const PLAN_LIMITS = {
  FREE: {
    label: "Free",
    priceLabel: "$0/mo",
    priceId: null,
    members: 3,
    projects: 3,
    storageBytes: 100 * 1024 * 1024,
    economyTool: false,
  },
  PRO: {
    label: "Pro",
    priceLabel: "$19/mo",
    priceId: process.env.STRIPE_PRICE_PRO,
    members: 10,
    projects: 20,
    storageBytes: 5 * 1024 * 1024 * 1024,
    economyTool: true,
  },
  BUSINESS: {
    label: "Business",
    priceLabel: "$49/mo",
    priceId: process.env.STRIPE_PRICE_BUSINESS,
    members: Infinity,
    projects: Infinity,
    storageBytes: 50 * 1024 * 1024 * 1024,
    economyTool: true,
  },
};

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${bytes / (1024 * 1024 * 1024)}GB`;
  return `${bytes / (1024 * 1024)}MB`;
}

/** Deny-by-default: only "active"/"trialing" count. past_due, canceled, unpaid, etc. all fall through to Free-tier limits immediately, no grace period. */
export function isSubscriptionActive(workspace) {
  return workspace.subscriptionStatus === "active" || workspace.subscriptionStatus === "trialing";
}

/**
 * Belt-and-suspenders against a stale `plan` value (e.g. a delayed webhook,
 * or a lapsed subscription the sync hasn't caught up on yet) — the DB row
 * can say PRO, but if the subscription isn't actually active, the *effective*
 * limits are still Free's. One function, not a separate "raw" vs "effective"
 * pair, so callers can't accidentally use the wrong one.
 */
export function getPlanLimits(workspace) {
  if (workspace.plan === "FREE") return PLAN_LIMITS.FREE;
  return isSubscriptionActive(workspace) ? PLAN_LIMITS[workspace.plan] : PLAN_LIMITS.FREE;
}

async function requireWorkspace(workspaceId) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new ValidationError("Workspace not found.");
  return workspace;
}

/** Bundles member/project/storage usage for the /billing display page — not used by the narrow assert* checks below, to avoid over-fetching on every signup/project-create/upload. */
export async function getWorkspaceUsage(workspaceId) {
  const [members, projects, storage] = await Promise.all([
    prisma.user.count({ where: { workspaceId } }),
    prisma.project.count({ where: { workspaceId } }),
    prisma.attachment.aggregate({
      where: { task: { project: { workspaceId } } },
      _sum: { size: true },
    }),
  ]);
  return { members, projects, storageBytes: storage._sum.size || 0 };
}

/**
 * Never retroactive: a workspace that falls below its new lower limit after
 * a downgrade/cancellation keeps every existing member/project/diagram —
 * these four checks only ever block *new* creation. Matches the existing
 * MAX_NODES_PER_DIAGRAM/MAX_ATTACHMENTS_PER_TASK caps in lib/economy.js and
 * lib/tasks.js: check-then-act, no transaction/lock. Two truly concurrent
 * requests could both pass before either commits, same as those — and since
 * pricing is flat per workspace (not usage-metered), a workspace transiently
 * 1-over its cap costs nothing, so that race isn't worth hardening here
 * either.
 */
export async function assertCanAddMember(workspaceId) {
  const workspace = await requireWorkspace(workspaceId);
  const limits = getPlanLimits(workspace);
  if (limits.members === Infinity) return;
  const count = await prisma.user.count({ where: { workspaceId } });
  if (count >= limits.members) {
    throw new ValidationError(`The ${limits.label} plan allows up to ${limits.members} members. Upgrade to add more.`);
  }
}

export async function assertCanCreateProject(workspaceId) {
  const workspace = await requireWorkspace(workspaceId);
  const limits = getPlanLimits(workspace);
  if (limits.projects === Infinity) return;
  const count = await prisma.project.count({ where: { workspaceId } });
  if (count >= limits.projects) {
    throw new ValidationError(`The ${limits.label} plan allows up to ${limits.projects} projects. Upgrade to add more.`);
  }
}

/** Checked before the Blob upload happens (see the task-detail page's handleAddAttachment), not just before the DB insert — no reason to pay for a costly upload only to reject it at the metadata-save step. */
export async function assertStorageQuota(workspaceId, incomingBytes) {
  const workspace = await requireWorkspace(workspaceId);
  const limits = getPlanLimits(workspace);
  if (limits.storageBytes === Infinity) return;
  const { _sum } = await prisma.attachment.aggregate({
    where: { task: { project: { workspaceId } } },
    _sum: { size: true },
  });
  const used = _sum.size || 0;
  if (used + incomingBytes > limits.storageBytes) {
    throw new ValidationError(`The ${limits.label} plan allows ${formatBytes(limits.storageBytes)} of attachment storage. Upgrade for more.`);
  }
}

/** Existing diagrams stay viewable forever regardless of plan — this only blocks creating new ones. */
export async function assertEconomyToolEntitlement(workspaceId) {
  const workspace = await requireWorkspace(workspaceId);
  const limits = getPlanLimits(workspace);
  if (!limits.economyTool) {
    throw new ValidationError("The economy simulation tool requires the Pro or Business plan.");
  }
}

async function requireOwner(workspaceId, actingUserId) {
  const actingUser = await prisma.user.findUnique({ where: { id: actingUserId } });
  if (!actingUser || actingUser.workspaceId !== workspaceId || actingUser.role !== "OWNER") {
    throw new ValidationError("Only the workspace owner can manage billing.");
  }
  return actingUser;
}

function appUrl(path) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Returns a Stripe-hosted Checkout URL to redirect to. Re-checks OWNER
 * server-side (mirrors removeMember's pattern in lib/workspace.js exactly)
 * — page-level isOwner hiding is UI-only, this is the check that actually
 * matters, since checkout moves real money.
 */
export async function createCheckoutSession({ workspaceId, actingUserId, planKey }) {
  const plan = PLAN_LIMITS[planKey];
  if (!plan || !plan.priceId) throw new ValidationError("Unknown plan.");

  const actingUser = await requireOwner(workspaceId, actingUserId);
  const workspace = await requireWorkspace(workspaceId);

  // Guards against a double-tab/double-click creating a second Stripe
  // subscription that silently orphans (and keeps billing) the first one
  // when the second checkout.session.completed webhook overwrites
  // stripeSubscriptionId. An already-subscribed workspace switching plans
  // goes through changePlan() instead, which never reaches this function.
  if (workspace.stripeSubscriptionId && isSubscriptionActive(workspace)) {
    throw new ValidationError("You already have an active subscription.");
  }

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    client_reference_id: workspaceId,
    metadata: { workspaceId },
    subscription_data: { metadata: { workspaceId } },
    customer: workspace.stripeCustomerId || undefined,
    customer_email: workspace.stripeCustomerId ? undefined : actingUser.email,
    success_url: appUrl("/billing?checkout=success"),
    cancel_url: appUrl("/billing?checkout=cancel"),
  });

  return session.url;
}

/** Returns a Stripe-hosted Customer Portal URL — same owner re-check as createCheckoutSession. */
export async function createPortalSession({ workspaceId, actingUserId }) {
  await requireOwner(workspaceId, actingUserId);
  const workspace = await requireWorkspace(workspaceId);

  if (!workspace.stripeCustomerId) {
    throw new ValidationError("No billing account on file yet — subscribe to a paid plan first.");
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: appUrl("/billing"),
  });

  return session.url;
}

/**
 * Switches an already-subscribed workspace directly to a different paid
 * plan by updating the existing Stripe subscription's price in place
 * (stripe.subscriptions.update), rather than sending the customer through
 * Checkout again or relying on the Customer Portal's built-in plan-switch
 * UI. Deliberate choice: the Portal's `subscription_update.products`
 * allow-list — the documented way to offer cross-product switching there —
 * doesn't take effect on this account (confirmed by setting it via the API
 * directly, per the documented request shape, and it not persisting on
 * re-fetch), so a customer using the Portal can only cancel, not switch.
 * This function is what actually makes Pro<->Business switching work,
 * called directly from app/billing/page.js rather than deferred to Stripe's
 * hosted UI. Same owner re-check as createCheckoutSession/createPortalSession
 * — this moves real money.
 */
export async function changePlan({ workspaceId, actingUserId, planKey }) {
  const plan = PLAN_LIMITS[planKey];
  if (!plan || !plan.priceId) throw new ValidationError("Unknown plan.");

  await requireOwner(workspaceId, actingUserId);
  const workspace = await requireWorkspace(workspaceId);

  if (!workspace.stripeSubscriptionId || !isSubscriptionActive(workspace)) {
    throw new ValidationError("No active subscription to change — subscribe first.");
  }
  if (workspace.plan === planKey) {
    throw new ValidationError(`Already on the ${plan.label} plan.`);
  }

  const subscription = await stripeClient().subscriptions.retrieve(workspace.stripeSubscriptionId);
  const currentItem = subscription.items.data[0];

  await stripeClient().subscriptions.update(workspace.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: plan.priceId }],
    proration_behavior: "create_prorations",
  });

  // The customer.subscription.updated webhook this triggers is what
  // actually syncs Workspace.plan (see syncSubscriptionFromStripeEvent) —
  // deliberately not updated here too, to keep exactly one place that
  // writes plan state from Stripe data and avoid the two ever disagreeing
  // if the webhook processes a slightly different payload than expected.
}

/** Reverse-maps a Stripe Price ID back to our plan key. Returns null for an unrecognized price — defensive against a stale/wrong Price ID reaching the webhook. */
export function planTierForPriceId(priceId) {
  for (const [key, limits] of Object.entries(PLAN_LIMITS)) {
    if (limits.priceId && limits.priceId === priceId) return key;
  }
  return null;
}

/**
 * Pure function taking an already-parsed Stripe event object — testable
 * directly, no need to mock stripe.webhooks.constructEvent (that thin
 * signature-verification wrapper is left as an untested external-I/O
 * boundary, same treatment as lib/email.js/lib/blob.js).
 *
 * Every write is update/upsert keyed by workspace, never a bare create —
 * makes this naturally idempotent against Stripe's at-least-once webhook
 * delivery without needing a separate processed-events dedup table.
 * Unrecognized event types are a silent no-op: Stripe retries events a
 * handler throws on, and an endpoint subscribed broadly receives plenty of
 * event types this app doesn't act on.
 */
export async function syncSubscriptionFromStripeEvent(event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const workspaceId = session.metadata?.workspaceId;
      if (!workspaceId) return;
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        },
      });
      return;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: subscription.customer } });
      if (!workspace) return;

      const item = subscription.items?.data?.[0];
      const plan = planTierForPriceId(item?.price?.id) || workspace.plan;
      const periodEndUnix = item?.current_period_end;

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        },
      });
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: subscription.customer } });
      if (!workspace) return;
      await prisma.workspace.update({
        where: { id: workspace.id },
        // stripeSubscriptionId is kept, not nulled, as a record of history.
        data: { plan: "FREE", subscriptionStatus: "canceled" },
      });
      return;
    }

    default:
      return;
  }
}
