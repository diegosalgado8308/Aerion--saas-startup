import bcrypt from "bcryptjs";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Admin",
  description: "Manage Aerion Software clients, projects, and invoices.",
};

async function createClient(formData) {
  "use server";

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const company = formData.get("company")?.toString().trim() || null;

  if (!name || !email || !password) return;

  const hashed = await bcrypt.hash(password, 10);

  await prisma.client.create({
    data: { name, email, password: hashed, company },
  });

  revalidatePath("/admin");
}

export default async function AdminPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { projects: true, invoices: true } },
    },
  });

  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="container">
        <div className="dashboard-header">
          <div>
            <div className="eyebrow">Aerion Admin</div>
            <h1>Clients</h1>
          </div>
          <SignOutButton />
        </div>

        <div className="grid grid-2" style={{ alignItems: "start", gap: 32 }}>
          <div>
            <div className="table-card">
              {clients.length === 0 ? (
                <div className="empty-state">No clients yet — add the first one.</div>
              ) : (
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Company</th>
                      <th>Projects</th>
                      <th>Invoices</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          {client.name}
                          <div style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>{client.email}</div>
                        </td>
                        <td>{client.company || "—"}</td>
                        <td>{client._count.projects}</td>
                        <td>{client._count.invoices}</td>
                        <td>
                          <Link href={`/admin/clients/${client.id}`} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                            Manage
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="form-card">
            <h3 className="mb-16">Add a client</h3>
            <form action={createClient}>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input type="text" id="name" name="name" placeholder="Jordan Lee" required />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" placeholder="jordan@company.com" required />
              </div>
              <div className="field">
                <label htmlFor="company">Company</label>
                <input type="text" id="company" name="company" placeholder="Company name" />
              </div>
              <div className="field">
                <label htmlFor="password">Temporary password</label>
                <input type="text" id="password" name="password" placeholder="Set a password for them" required />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Create client</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
