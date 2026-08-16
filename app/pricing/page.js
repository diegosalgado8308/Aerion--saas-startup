import Link from "next/link";
import { auth } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/billing";

export const metadata = { title: "Pricing" };

function formatLimit(value, unit) {
  return value === Infinity ? "Unlimited" : `${value} ${unit}`;
}

function formatStorage(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${bytes / (1024 * 1024 * 1024)}GB storage`;
  return `${bytes / (1024 * 1024)}MB storage`;
}

const TIERS = [
  { key: "FREE", tagline: "Try it with a small team." },
  { key: "PRO", tagline: "For growing teams that need more room." },
  { key: "BUSINESS", tagline: "Unlimited members and projects." },
];

export default async function PricingPage() {
  const session = await auth();
  const ctaHref = session ? "/billing" : "/signup";

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Simple, flat pricing</h1>
          <p className="text-muted">One price per workspace — no per-seat fees.</p>
        </div>
      </div>

      <div className="grid grid-3">
        {TIERS.map(({ key, tagline }) => {
          const plan = PLAN_LIMITS[key];
          return (
            <div key={key} className="card">
              <h3>{plan.label}</h3>
              <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: "8px 0" }}>{plan.priceLabel}</p>
              <p className="text-muted" style={{ marginBottom: 16 }}>{tagline}</p>
              <ul style={{ marginBottom: 20 }}>
                <li style={{ marginBottom: 6 }}>{formatLimit(plan.members, "members")}</li>
                <li style={{ marginBottom: 6 }}>{formatLimit(plan.projects, "projects")}</li>
                <li style={{ marginBottom: 6 }}>{formatStorage(plan.storageBytes)}</li>
                <li style={{ marginBottom: 6 }}>{plan.economyTool ? "Economy simulation tool" : "No economy simulation tool"}</li>
              </ul>
              <Link href={ctaHref} className="btn btn-primary btn-block">
                {key === "FREE" ? "Get started" : "Upgrade"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
