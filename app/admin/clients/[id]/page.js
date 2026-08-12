import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Manage Client",
};

const PROJECT_STATUSES = ["Planning", "In Progress", "Review", "Completed"];
const INVOICE_STATUSES = ["Due", "Paid", "Overdue"];

async function addProject(clientId, formData) {
  "use server";
  const name = formData.get("name")?.toString().trim();
  const status = formData.get("status")?.toString();
  const progress = Number(formData.get("progress")) || 0;
  const description = formData.get("description")?.toString().trim() || null;
  if (!name || !status) return;

  await prisma.project.create({
    data: { name, status, progress: Math.min(100, Math.max(0, progress)), description, clientId },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function updateProject(clientId, projectId, formData) {
  "use server";
  const status = formData.get("status")?.toString();
  const progress = Number(formData.get("progress")) || 0;

  await prisma.project.update({
    where: { id: projectId },
    data: { status, progress: Math.min(100, Math.max(0, progress)) },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function deleteProject(clientId, projectId) {
  "use server";
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function addInvoice(clientId, formData) {
  "use server";
  const number = formData.get("number")?.toString().trim();
  const amount = Number(formData.get("amount"));
  const status = formData.get("status")?.toString();
  const dueDate = formData.get("dueDate")?.toString();
  if (!number || !status || !dueDate || Number.isNaN(amount)) return;

  await prisma.invoice.create({
    data: {
      number,
      amountCents: Math.round(amount * 100),
      status,
      dueDate: new Date(dueDate),
      clientId,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function updateInvoiceStatus(clientId, invoiceId, formData) {
  "use server";
  const status = formData.get("status")?.toString();
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function deleteInvoice(clientId, invoiceId) {
  "use server";
  await prisma.invoice.delete({ where: { id: invoiceId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

async function deleteClient(clientId) {
  "use server";
  await prisma.client.delete({ where: { id: clientId } });
  redirect("/admin");
}

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function toDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export default async function AdminClientDetailPage({ params }) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { updatedAt: "desc" } },
      invoices: { orderBy: { dueDate: "asc" } },
    },
  });

  if (!client) notFound();

  const addProjectForClient = addProject.bind(null, client.id);
  const addInvoiceForClient = addInvoice.bind(null, client.id);
  const deleteClientForClient = deleteClient.bind(null, client.id);

  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container">
        <div className="dashboard-header">
          <div>
            <Link href="/admin" style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>&larr; All clients</Link>
            <h1 className="mt-8">{client.name}</h1>
            <p style={{ color: "var(--text-muted)" }}>{client.email}{client.company ? ` · ${client.company}` : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <form action={deleteClientForClient}>
              <button type="submit" className="btn btn-secondary">Delete client</button>
            </form>
            <SignOutButton />
          </div>
        </div>

        <div className="section-head">
          <h2 style={{ fontSize: "1.4rem" }}>Projects</h2>
        </div>
        <div className="grid grid-3 mb-24">
          {client.projects.map((project) => {
            const updateForProject = updateProject.bind(null, client.id, project.id);
            const deleteForProject = deleteProject.bind(null, client.id, project.id);
            return (
              <div key={project.id} className="card project-card">
                <div className="project-card-top">
                  <h3>{project.name}</h3>
                </div>
                {project.description && <p>{project.description}</p>}
                <form action={updateForProject} className="mt-16">
                  <div className="field">
                    <label>Status</label>
                    <select name="status" defaultValue={project.status}>
                      {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Progress (%)</label>
                    <input type="number" name="progress" min="0" max="100" defaultValue={project.progress} />
                  </div>
                  <button type="submit" className="btn btn-secondary btn-block">Save</button>
                </form>
                <form action={deleteForProject} className="mt-8">
                  <button type="submit" className="btn btn-secondary btn-block">Delete project</button>
                </form>
              </div>
            );
          })}

          <div className="card">
            <h3 className="mb-16">Add project</h3>
            <form action={addProjectForClient}>
              <div className="field">
                <label>Name</label>
                <input type="text" name="name" placeholder="Project name" required />
              </div>
              <div className="field">
                <label>Status</label>
                <select name="status" defaultValue="Planning">
                  {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Progress (%)</label>
                <input type="number" name="progress" min="0" max="100" defaultValue={0} />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea name="description" placeholder="Optional" />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Add project</button>
            </form>
          </div>
        </div>

        <div className="section-head mt-32">
          <h2 style={{ fontSize: "1.4rem" }}>Invoices</h2>
        </div>
        <div className="table-card mb-24">
          {client.invoices.length === 0 ? (
            <div className="empty-state">No invoices yet.</div>
          ) : (
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {client.invoices.map((invoice) => {
                  const updateForInvoice = updateInvoiceStatus.bind(null, client.id, invoice.id);
                  const deleteForInvoice = deleteInvoice.bind(null, client.id, invoice.id);
                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.number}</td>
                      <td className="invoice-amount">{formatCents(invoice.amountCents)}</td>
                      <td>{toDateInputValue(invoice.dueDate)}</td>
                      <td>
                        <form action={updateForInvoice} style={{ display: "flex", gap: 8 }}>
                          <select name="status" defaultValue={invoice.status}>
                            {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <button type="submit" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Save</button>
                        </form>
                      </td>
                      <td>
                        <form action={deleteForInvoice}>
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

        <div className="form-card" style={{ maxWidth: 520 }}>
          <h3 className="mb-16">Add invoice</h3>
          <form action={addInvoiceForClient}>
            <div className="form-row">
              <div className="field">
                <label>Invoice number</label>
                <input type="text" name="number" placeholder="INV-1001" required />
              </div>
              <div className="field">
                <label>Amount (USD)</label>
                <input type="number" name="amount" step="0.01" min="0" placeholder="1250.00" required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Due date</label>
                <input type="date" name="dueDate" required />
              </div>
              <div className="field">
                <label>Status</label>
                <select name="status" defaultValue="Due">
                  {INVOICE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block">Add invoice</button>
          </form>
        </div>
      </div>
    </section>
  );
}
