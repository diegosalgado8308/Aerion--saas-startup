import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/projects";
import { createDiagram } from "@/lib/economy";
import { joinWorkspaceViaInvite, ValidationError } from "@/lib/workspace";
import {
  PLAN_LIMITS,
  getPlanLimits,
  isSubscriptionActive,
  assertStorageQuota,
  assertEconomyToolEntitlement,
  createCheckoutSession,
  planTierForPriceId,
  syncSubscriptionFromStripeEvent,
} from "@/lib/billing";
import { uniqueEmail, makeTenant, cleanupWorkspace } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

async function setPlan(workspaceId, { plan, subscriptionStatus = null, stripeCustomerId = null, stripeSubscriptionId = null }) {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { plan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId },
  });
}

describe("member limit (via joinWorkspaceViaInvite)", () => {
  it("allows joining under the Free plan's 3-member cap", async () => {
    const { workspace } = await makeTenant("member-under");
    createdWorkspaceIds.push(workspace.id);

    await joinWorkspaceViaInvite({ name: "Member 2", email: uniqueEmail("m2"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });
    const members = await prisma.user.count({ where: { workspaceId: workspace.id } });
    expect(members).toBe(2);
  });

  it("rejects joining once the Free plan's 3-member cap is reached", async () => {
    const { workspace } = await makeTenant("member-over");
    createdWorkspaceIds.push(workspace.id);

    // Owner (1) + 2 more = 3, at the cap.
    await joinWorkspaceViaInvite({ name: "M2", email: uniqueEmail("m2"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });
    await joinWorkspaceViaInvite({ name: "M3", email: uniqueEmail("m3"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });

    await expect(
      joinWorkspaceViaInvite({ name: "M4", email: uniqueEmail("m4"), password: "correct-horse-battery", inviteCode: workspace.inviteCode })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows more members once upgraded to Pro", async () => {
    const { workspace } = await makeTenant("member-pro");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "PRO", subscriptionStatus: "active" });

    await joinWorkspaceViaInvite({ name: "M2", email: uniqueEmail("m2"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });
    await joinWorkspaceViaInvite({ name: "M3", email: uniqueEmail("m3"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });
    await joinWorkspaceViaInvite({ name: "M4", email: uniqueEmail("m4"), password: "correct-horse-battery", inviteCode: workspace.inviteCode });

    const members = await prisma.user.count({ where: { workspaceId: workspace.id } });
    expect(members).toBe(4);
  });
});

describe("project limit (via createProject)", () => {
  it("allows up to the Free plan's 3-project cap, rejects the 4th", async () => {
    const { workspace } = await makeTenant("project-cap");
    createdWorkspaceIds.push(workspace.id);

    await createProject(workspace.id, { name: "P1" });
    await createProject(workspace.id, { name: "P2" });
    await createProject(workspace.id, { name: "P3" });

    await expect(createProject(workspace.id, { name: "P4" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows unlimited projects on Business", async () => {
    const { workspace } = await makeTenant("project-business");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "BUSINESS", subscriptionStatus: "active" });

    for (let i = 0; i < 5; i += 1) {
      await createProject(workspace.id, { name: `P${i}` });
    }
    const count = await prisma.project.count({ where: { workspaceId: workspace.id } });
    expect(count).toBe(5);
  });
});

describe("assertStorageQuota", () => {
  async function makeTenantWithTask(label) {
    const { workspace } = await makeTenant(label);
    const project = await createProject(workspace.id, { name: `${label} project` });
    const task = await prisma.task.create({ data: { title: "T", projectId: project.id } });
    return { workspace, task };
  }

  it("allows an upload under the Free plan's 100MB cap", async () => {
    const { workspace } = await makeTenantWithTask("storage-under");
    createdWorkspaceIds.push(workspace.id);
    await expect(assertStorageQuota(workspace.id, 10 * 1024 * 1024)).resolves.toBeUndefined();
  });

  it("rejects an upload that would push the workspace past the Free plan's 100MB cap", async () => {
    const { workspace, task } = await makeTenantWithTask("storage-over");
    createdWorkspaceIds.push(workspace.id);

    // Bulk-insert directly at the cap — fast setup, not itself under test.
    await prisma.attachment.create({
      data: { filename: "big.bin", url: "https://example-blob.vercel-storage.com/big.bin", size: 99 * 1024 * 1024, taskId: task.id },
    });

    await expect(assertStorageQuota(workspace.id, 5 * 1024 * 1024)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("assertEconomyToolEntitlement (via createDiagram)", () => {
  it("blocks creating a diagram on the Free plan", async () => {
    const { workspace } = await makeTenant("economy-free");
    createdWorkspaceIds.push(workspace.id);
    const project = await createProject(workspace.id, { name: "P" });

    await expect(createDiagram(project.id, workspace.id, { name: "D" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows creating a diagram on Pro", async () => {
    const { workspace } = await makeTenant("economy-pro");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "PRO", subscriptionStatus: "active" });
    const project = await createProject(workspace.id, { name: "P" });

    const diagram = await createDiagram(project.id, workspace.id, { name: "D" });
    expect(diagram.name).toBe("D");
  });
});

describe("getPlanLimits / isSubscriptionActive", () => {
  it("falls back to Free limits when plan is Pro but the subscription is past_due", async () => {
    const workspace = { plan: "PRO", subscriptionStatus: "past_due" };
    expect(isSubscriptionActive(workspace)).toBe(false);
    expect(getPlanLimits(workspace)).toBe(PLAN_LIMITS.FREE);
  });

  it("falls back to Free limits when plan is Business but subscriptionStatus is null", async () => {
    const workspace = { plan: "BUSINESS", subscriptionStatus: null };
    expect(getPlanLimits(workspace)).toBe(PLAN_LIMITS.FREE);
  });

  it("treats trialing as active", () => {
    const workspace = { plan: "PRO", subscriptionStatus: "trialing" };
    expect(isSubscriptionActive(workspace)).toBe(true);
    expect(getPlanLimits(workspace)).toBe(PLAN_LIMITS.PRO);
  });
});

describe("createCheckoutSession", () => {
  it("rejects a non-owner", async () => {
    const { workspace } = await makeTenant("checkout-nonowner");
    createdWorkspaceIds.push(workspace.id);
    const { user: member } = await joinWorkspaceViaInvite({
      name: "Member", email: uniqueEmail("nonowner"), password: "correct-horse-battery", inviteCode: workspace.inviteCode,
    });

    await expect(
      createCheckoutSession({ workspaceId: workspace.id, actingUserId: member.id, planKey: "PRO" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a workspace that already has an active subscription", async () => {
    const { workspace, user: owner } = await makeTenant("checkout-double");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "PRO", subscriptionStatus: "active", stripeCustomerId: "cus_fake", stripeSubscriptionId: "sub_fake" });

    await expect(
      createCheckoutSession({ workspaceId: workspace.id, actingUserId: owner.id, planKey: "BUSINESS" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an unknown plan key before ever reaching Stripe", async () => {
    const { workspace, user: owner } = await makeTenant("checkout-badplan");
    createdWorkspaceIds.push(workspace.id);

    await expect(
      createCheckoutSession({ workspaceId: workspace.id, actingUserId: owner.id, planKey: "NOT_A_PLAN" })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("planTierForPriceId", () => {
  it("maps a known price ID back to its plan key", () => {
    expect(planTierForPriceId(PLAN_LIMITS.PRO.priceId)).toBe("PRO");
    expect(planTierForPriceId(PLAN_LIMITS.BUSINESS.priceId)).toBe("BUSINESS");
  });

  it("returns null for an unrecognized price ID", () => {
    expect(planTierForPriceId("price_does_not_exist")).toBeNull();
  });
});

describe("syncSubscriptionFromStripeEvent", () => {
  it("checkout.session.completed sets stripeCustomerId/stripeSubscriptionId from event metadata", async () => {
    const { workspace } = await makeTenant("sync-checkout");
    createdWorkspaceIds.push(workspace.id);

    await syncSubscriptionFromStripeEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: { workspaceId: workspace.id }, customer: "cus_123", subscription: "sub_123" } },
    });

    const refreshed = await prisma.workspace.findUnique({ where: { id: workspace.id } });
    expect(refreshed.stripeCustomerId).toBe("cus_123");
    expect(refreshed.stripeSubscriptionId).toBe("sub_123");
  });

  it("customer.subscription.updated syncs plan (from the price), status, and currentPeriodEnd", async () => {
    const { workspace } = await makeTenant("sync-updated");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "FREE", stripeCustomerId: "cus_456" });

    const periodEndUnix = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await syncSubscriptionFromStripeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_456",
          status: "active",
          items: { data: [{ price: { id: PLAN_LIMITS.PRO.priceId }, current_period_end: periodEndUnix }] },
        },
      },
    });

    const refreshed = await prisma.workspace.findUnique({ where: { id: workspace.id } });
    expect(refreshed.plan).toBe("PRO");
    expect(refreshed.subscriptionStatus).toBe("active");
    expect(refreshed.currentPeriodEnd.getTime()).toBe(periodEndUnix * 1000);
  });

  it("customer.subscription.updated picks up a Portal-initiated plan switch (Pro -> Business)", async () => {
    const { workspace } = await makeTenant("sync-switch");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "PRO", subscriptionStatus: "active", stripeCustomerId: "cus_789" });

    await syncSubscriptionFromStripeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_789",
          status: "active",
          items: { data: [{ price: { id: PLAN_LIMITS.BUSINESS.priceId }, current_period_end: Math.floor(Date.now() / 1000) }] },
        },
      },
    });

    const refreshed = await prisma.workspace.findUnique({ where: { id: workspace.id } });
    expect(refreshed.plan).toBe("BUSINESS");
  });

  it("customer.subscription.deleted resets the workspace to Free but keeps stripeSubscriptionId for history", async () => {
    const { workspace } = await makeTenant("sync-deleted");
    createdWorkspaceIds.push(workspace.id);
    await setPlan(workspace.id, { plan: "PRO", subscriptionStatus: "active", stripeCustomerId: "cus_abc", stripeSubscriptionId: "sub_abc" });

    await syncSubscriptionFromStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_abc" } },
    });

    const refreshed = await prisma.workspace.findUnique({ where: { id: workspace.id } });
    expect(refreshed.plan).toBe("FREE");
    expect(refreshed.subscriptionStatus).toBe("canceled");
    expect(refreshed.stripeSubscriptionId).toBe("sub_abc");
  });

  it("is a silent no-op for an unrecognized event type", async () => {
    await expect(syncSubscriptionFromStripeEvent({ type: "invoice.paid", data: { object: {} } })).resolves.toBeUndefined();
  });

  it("is a silent no-op when the referenced workspace/customer can't be found", async () => {
    await expect(
      syncSubscriptionFromStripeEvent({
        type: "customer.subscription.updated",
        data: { object: { customer: "cus_does_not_exist", status: "active", items: { data: [] } } },
      })
    ).resolves.toBeUndefined();
  });
});
