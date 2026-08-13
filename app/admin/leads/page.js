import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Leads",
  description: "Contact form submissions for Aerion Software.",
};

const LEAD_STATUSES = ["New", "Contacted", "Archived"];

async function updateLeadStatus(leadId, formData) {
  "use server";
  const status = formData.get("status")?.toString();
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  revalidatePath("/admin/leads");
}

async function deleteLead(leadId) {
  "use server";
  await prisma.lead.delete({ where: { id: leadId } });
  revalidatePath("/admin/leads");
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminLeadsPage() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container">
        <div className="dashboard-header">
          <div>
            <Link href="/admin" style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>&larr; Clients</Link>
            <div className="eyebrow mt-8">Aerion Admin</div>
            <h1>Leads</h1>
          </div>
          <SignOutButton />
        </div>

        <div className="table-card">
          {leads.length === 0 ? (
            <div className="empty-state">No leads yet — submissions from the contact form will show up here.</div>
          ) : (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Budget</th>
                  <th>Message</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const updateForLead = updateLeadStatus.bind(null, lead.id);
                  const deleteForLead = deleteLead.bind(null, lead.id);
                  return (
                    <tr key={lead.id}>
                      <td>
                        {lead.name}
                        <div style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>
                          {lead.email}{lead.company ? ` · ${lead.company}` : ""}
                        </div>
                      </td>
                      <td>{lead.budget || "—"}</td>
                      <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>{lead.message}</td>
                      <td>{formatDate(lead.createdAt)}</td>
                      <td>
                        <form action={updateForLead} style={{ display: "flex", gap: 8 }}>
                          <select name="status" defaultValue={lead.status}>
                            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <button type="submit" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Save</button>
                        </form>
                      </td>
                      <td>
                        <form action={deleteForLead}>
                          <button type="submit" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Delete</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
