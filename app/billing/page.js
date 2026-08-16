import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, getPlanLimits, getWorkspaceUsage, createCheckoutSession, createPortalSession } from "@/lib/billing";
import { ValidationError } from "@/lib/workspace";
import Toast from "@/components/Toast";
import LivePoll from "@/components/LivePoll";

export const metadata = { title: "Billing" };

function formatLimit(value) {
  return value === Infinity ? "Unlimited" : value;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default async function BillingPage({ searchParams }) {
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;
  const checkoutStatus = sp?.checkout;

  const workspace = await prisma.workspace.findUnique({ where: { id: session.user.workspaceId } });
  const limits = getPlanLimits(workspace);
  const usage = await getWorkspaceUsage(workspace.id);
  const isOwner = session.user.role === "OWNER";

  async function handleUpgrade(formData) {
    "use server";
    const session = await auth();
    try {
      const url = await createCheckoutSession({
        workspaceId: session.user.workspaceId,
        actingUserId: session.user.id,
        planKey: formData.get("plan"),
      });
      redirect(url);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/billing?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  async function handleManageSubscription() {
    "use server";
    const session = await auth();
    try {
      const url = await createPortalSession({
        workspaceId: session.user.workspaceId,
        actingUserId: session.user.id,
      });
      redirect(url);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/billing?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  return (
    <div className="container page">
      {/* Catches the webhook-lag window between Stripe's redirect back here and the webhook actually landing — self-corrects within a couple seconds. */}
      {checkoutStatus === "success" && <LivePoll intervalMs={2000} />}

      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="text-muted">{workspace.name}</p>
        </div>
      </div>

      <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />
      <Toast
        key={checkoutStatus ? crypto.randomUUID() : "no-checkout"}
        message={checkoutStatus === "success" ? "Subscription updated." : checkoutStatus === "cancel" ? "Checkout canceled." : null}
        type={checkoutStatus === "success" ? "success" : "error"}
      />

      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 4 }}>Current plan: {limits.label}</h3>
        <p className="text-muted" style={{ marginBottom: 16 }}>{limits.priceLabel}</p>
        <ul style={{ marginBottom: isOwner ? 20 : 0 }}>
          <li style={{ marginBottom: 6 }}>Members: {usage.members} / {formatLimit(limits.members)}</li>
          <li style={{ marginBottom: 6 }}>Projects: {usage.projects} / {formatLimit(limits.projects)}</li>
          <li style={{ marginBottom: 6 }}>Storage: {formatBytes(usage.storageBytes)} / {limits.storageBytes === Infinity ? "Unlimited" : formatBytes(limits.storageBytes)}</li>
          <li>Economy simulation tool: {limits.economyTool ? "Included" : "Not included"}</li>
        </ul>

        {isOwner && workspace.stripeCustomerId && (
          <form action={handleManageSubscription} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button type="submit" className="btn btn-secondary">Manage subscription</button>
          </form>
        )}
      </div>

      {isOwner && (
        <>
          <h3 style={{ marginBottom: 16 }}>Change plan</h3>
          <div className="grid grid-3">
            {Object.entries(PLAN_LIMITS)
              .filter(([key]) => key !== "FREE")
              .map(([key, plan]) => (
                <div key={key} className="card">
                  <h3>{plan.label}</h3>
                  <p style={{ fontSize: "1.4rem", fontWeight: 700, margin: "8px 0" }}>{plan.priceLabel}</p>
                  <form action={handleUpgrade}>
                    <input type="hidden" name="plan" value={key} />
                    <button type="submit" className="btn btn-primary btn-block" disabled={workspace.plan === key}>
                      {workspace.plan === key ? "Current plan" : "Upgrade"}
                    </button>
                  </form>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
