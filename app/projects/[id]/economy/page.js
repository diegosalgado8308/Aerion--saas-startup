import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProjectMeta } from "@/lib/projects";
import { getDiagramsForProject, createDiagram } from "@/lib/economy";
import { ValidationError } from "@/lib/workspace";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const session = await auth();
  const project = await getProjectMeta(id, session.user.workspaceId);
  return { title: project ? `Economy — ${project.name}` : "Economy" };
}

export default async function EconomyListPage({ params, searchParams }) {
  const { id } = await params;
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;

  const project = await getProjectMeta(id, session.user.workspaceId);
  if (!project) notFound();

  const diagrams = await getDiagramsForProject(id, session.user.workspaceId);

  async function handleCreate(formData) {
    "use server";
    const session = await auth();
    try {
      const diagram = await createDiagram(id, session.user.workspaceId, {
        name: formData.get("name"),
        description: formData.get("description"),
      });
      redirect(`/projects/${id}/economy/${diagram.id}`);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/projects/${id}/economy?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <Link href={`/projects/${id}`} className="text-faint" style={{ fontSize: "0.85rem" }}>&larr; {project.name}</Link>
          <h1 style={{ marginTop: 8 }}>Economy diagrams</h1>
          <p className="text-muted">Model resource flows for {project.name} and simulate how they play out over time.</p>
        </div>
      </div>

      {errorMessage && <div className="notice notice-error">{errorMessage}</div>}

      <div className="card" style={{ marginBottom: 32, maxWidth: 480 }}>
        <h3 style={{ marginBottom: 16 }}>New diagram</h3>
        <form action={handleCreate}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" name="name" placeholder="e.g. Core gold loop" required />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" placeholder="Optional" />
          </div>
          <button type="submit" className="btn btn-primary">Create diagram</button>
        </form>
      </div>

      {diagrams.length === 0 ? (
        <div className="empty-state">No diagrams yet — create your first one above.</div>
      ) : (
        <div className="table-card">
          {diagrams.map((diagram) => (
            <Link key={diagram.id} href={`/projects/${id}/economy/${diagram.id}`} className="economy-list-item" style={{ display: "flex" }}>
              <div>
                <h3 style={{ fontSize: "1rem" }}>{diagram.name}</h3>
                {diagram.description && <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>{diagram.description}</p>}
              </div>
              <span className="text-faint" style={{ fontSize: "0.8rem" }}>
                {diagram._count.nodes} node{diagram._count.nodes === 1 ? "" : "s"} · {diagram._count.connections} connection{diagram._count.connections === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
