import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getProjects, createProject } from "@/lib/projects";
import { ValidationError } from "@/lib/workspace";
import Toast from "@/components/Toast";

export const metadata = { title: "Projects" };

export default async function DashboardPage({ searchParams }) {
  const session = await auth();
  const params = await searchParams;
  const errorMessage = params?.error ? decodeURIComponent(params.error) : null;
  const page = Math.max(1, parseInt(params?.page, 10) || 1);

  const { items: projects, total, totalPages } = await getProjects(session.user.workspaceId, { page });

  async function handleCreateProject(formData) {
    "use server";
    const session = await auth();
    try {
      const project = await createProject(session.user.workspaceId, {
        name: formData.get("name"),
        description: formData.get("description"),
      });
      revalidatePath("/dashboard");
      redirect(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/dashboard?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="text-muted">Everything your workspace is working on.</p>
        </div>
      </div>

      <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />

      <div className="card" style={{ marginBottom: 32, maxWidth: 480 }}>
        <h3 style={{ marginBottom: 16 }}>New project</h3>
        <form action={handleCreateProject}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" name="name" placeholder="e.g. Website redesign" required />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" placeholder="Optional" />
          </div>
          <button type="submit" className="btn btn-primary">Create project</button>
        </form>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          {page > 1 ? "No more projects." : "No projects yet — create your first one above."}
        </div>
      ) : (
        <>
          <div className="grid grid-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="card project-card">
                <h3>{project.name}</h3>
                {project.description && <p className="text-muted">{project.description}</p>}
                <div className="project-meta">
                  <span>{project._count.tasks} task{project._count.tasks === 1 ? "" : "s"}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <span className="text-faint" style={{ fontSize: "0.82rem" }}>
                Page {page} of {totalPages} · {total} project{total === 1 ? "" : "s"} total
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {page > 1 && (
                  <Link href={`/dashboard?page=${page - 1}`} className="btn btn-secondary btn-sm">Previous</Link>
                )}
                {page < totalPages && (
                  <Link href={`/dashboard?page=${page + 1}`} className="btn btn-secondary btn-sm">Next</Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
