import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Dashboard",
  description: "Your Aerion Software client dashboard.",
};

const STATUS_CLASS = {
  "In Progress": "status-progress",
  Review: "status-review",
  Completed: "status-completed",
  Planning: "status-planning",
  Paid: "status-paid",
  Due: "status-due",
  Overdue: "status-overdue",
};

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const session = await auth();

  const [projects, invoices] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { clientId: session.user.id },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container">
        <div className="dashboard-header">
          <div>
            <div className="eyebrow">Client Portal</div>
            <h1>Welcome back, {session.user.name?.split(" ")[0] || "there"}</h1>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/portal/profile" className="btn btn-secondary">Profile</Link>
            <SignOutButton />
          </div>
        </div>

        <div className="section-head">
          <h2 style={{ fontSize: "1.4rem" }}>Projects</h2>
        </div>

        {projects.length === 0 ? (
          <div className="table-card"><div className="empty-state">No active projects yet.</div></div>
        ) : (
          <div className="grid grid-3 mb-24">
            {projects.map((project) => (
              <div key={project.id} className="card project-card">
                <div className="project-card-top">
                  <h3>{project.name}</h3>
                  <span className={`status-pill ${STATUS_CLASS[project.status] || ""}`}>{project.status}</span>
                </div>
                {project.description && <p>{project.description}</p>}
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="progress-label">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="section-head mt-32">
          <h2 style={{ fontSize: "1.4rem" }}>Invoices</h2>
        </div>

        <div className="table-card">
          {invoices.length === 0 ? (
            <div className="empty-state">No invoices on file.</div>
          ) : (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.number}</td>
                    <td className="invoice-amount">{formatCents(invoice.amountCents)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>
                      <span className={`status-pill ${STATUS_CLASS[invoice.status] || ""}`}>{invoice.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
