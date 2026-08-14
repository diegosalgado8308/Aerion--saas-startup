import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProjectForWorkspace, deleteProject } from "@/lib/projects";
import { createTask, updateTaskStatus, deleteTask } from "@/lib/tasks";
import { getWorkspaceMembers } from "@/lib/workspace";
import { ValidationError } from "@/lib/workspace";
import Toast from "@/components/Toast";
import FormattedDate from "@/components/FormattedDate";
import LivePoll from "@/components/LivePoll";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const session = await auth();
  const project = await getProjectForWorkspace(id, session.user.workspaceId);
  return { title: project?.name || "Project" };
}

const COLUMNS = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "DONE", label: "Done" },
];

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const PRIORITY_CLASS = { LOW: "pill-low", MEDIUM: "pill-medium", HIGH: "pill-high" };

function isOverdue(task) {
  if (!task.dueDate || task.status === "DONE") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
}


async function updateStatusForTask(taskId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await updateTaskStatus(taskId, session.user.workspaceId, formData.get("status"));
    revalidatePath(`/projects/${projectId}`);
  } catch (err) {
    if (err instanceof ValidationError) {
      redirect(`/projects/${projectId}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

async function deleteThisTask(taskId, projectId) {
  "use server";
  const session = await auth();
  await deleteTask(taskId, session.user.workspaceId);
  revalidatePath(`/projects/${projectId}`);
}

export default async function ProjectBoardPage({ params, searchParams }) {
  const { id } = await params;
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;

  const project = await getProjectForWorkspace(id, session.user.workspaceId);
  if (!project) notFound();

  const members = await getWorkspaceMembers(session.user.workspaceId);

  async function handleAddTask(formData) {
    "use server";
    const session = await auth();
    try {
      await createTask(session.user.workspaceId, id, {
        title: formData.get("title"),
        description: formData.get("description"),
        priority: formData.get("priority"),
        dueDate: formData.get("dueDate"),
        assigneeId: formData.get("assigneeId") || null,
      });
      revalidatePath(`/projects/${id}`);
    } catch (err) {
      if (err instanceof ValidationError) {
        redirect(`/projects/${id}?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
  }

  async function handleDeleteProject() {
    "use server";
    const session = await auth();
    await deleteProject(id, session.user.workspaceId);
    redirect("/dashboard");
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <Link href="/dashboard" className="text-faint" style={{ fontSize: "0.85rem" }}>&larr; All projects</Link>
          <h1 style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            {project.name}
            <span className="live-indicator" title="This board updates automatically — no need to refresh">
              <span className="live-dot" /> Live
            </span>
          </h1>
          {project.description && <p className="text-muted">{project.description}</p>}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href={`/projects/${id}/economy`} className="btn btn-secondary btn-sm">Economy diagrams</Link>
          <form action={handleDeleteProject}>
            <button type="submit" className="btn btn-danger btn-sm">Delete project</button>
          </form>
        </div>
      </div>

      <Toast key={errorMessage ? crypto.randomUUID() : "no-error"} message={errorMessage} type="error" />
      <LivePoll />

      {project.tasksTruncated && (
        <div className="notice notice-error" style={{ background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }}>
          Showing the first {project.tasks.length} of {project.taskTotal} tasks. Complete or archive some to see the rest.
        </div>
      )}

      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>New task</h3>
        <form action={handleAddTask}>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input type="text" id="title" name="title" placeholder="What needs to get done?" required />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" placeholder="Optional" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" name="priority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dueDate">Due date</label>
              <input type="date" id="dueDate" name="dueDate" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="assigneeId">Assignee</label>
            <select id="assigneeId" name="assigneeId" defaultValue="">
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Add task</button>
        </form>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const tasks = project.tasks.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="board-column">
              <div className="board-column-head">
                <h4>{col.label}</h4>
                <span className="column-count">{tasks.length}</span>
              </div>
              {tasks.map((task) => {
                const updateForTask = updateStatusForTask.bind(null, task.id, id);
                const deleteForTask = deleteThisTask.bind(null, task.id, id);
                const overdue = isOverdue(task);
                return (
                  <div key={task.id} className="task-card">
                    <Link href={`/projects/${id}/tasks/${task.id}`} className="task-card-title" style={{ display: "block" }}>{task.title}</Link>
                    <div className="task-card-meta">
                      <span className={`pill ${PRIORITY_CLASS[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                      {task.dueDate && (
                        <span className={`task-due${overdue ? " overdue" : ""}`}><FormattedDate date={task.dueDate} /></span>
                      )}
                    </div>
                    {task.assignee && (
                      <div className="task-assignee" style={{ marginTop: 8 }}>
                        <span className="avatar-sm" style={{ width: 18, height: 18, fontSize: "0.6rem" }}>
                          {task.assignee.name[0]}
                        </span>
                        {task.assignee.name}
                      </div>
                    )}
                    <form action={updateForTask} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <select name="status" defaultValue={task.status} className="status-select" style={{ marginTop: 0 }}>
                        <option value="TODO">To do</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                      </select>
                      <button type="submit" className="btn btn-secondary btn-sm">Move</button>
                    </form>
                    <form action={deleteForTask} style={{ marginTop: 8 }}>
                      <button type="submit" className="btn btn-danger btn-sm btn-block">Delete</button>
                    </form>
                  </div>
                );
              })}
              {tasks.length === 0 && <p className="text-faint" style={{ fontSize: "0.82rem", padding: "8px 4px" }}>No tasks</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
