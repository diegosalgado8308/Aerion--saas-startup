import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getTaskForWorkspace, updateTask, deleteTask, addComment, deleteComment, addAttachment, deleteAttachment } from "@/lib/tasks";
import { uploadAttachment, deleteAttachmentBlob } from "@/lib/blob";
import { ValidationError } from "@/lib/workspace";

export async function generateMetadata({ params }) {
  const { taskId } = await params;
  const session = await auth();
  const task = await getTaskForWorkspace(taskId, session.user.workspaceId);
  return { title: task?.title || "Task" };
}

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const PRIORITY_CLASS = { LOW: "pill-low", MEDIUM: "pill-medium", HIGH: "pill-high" };
const STATUS_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" };

function formatDateTime(date) {
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TaskDetailPage({ params, searchParams }) {
  const { id: projectId, taskId } = await params;
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;

  const task = await getTaskForWorkspace(taskId, session.user.workspaceId);
  if (!task || task.projectId !== projectId) notFound();

  async function handleUpdateStatus(formData) {
    "use server";
    const session = await auth();
    try {
      await updateTask(taskId, session.user.workspaceId, { status: formData.get("status") });
      revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err) {
      if (err instanceof ValidationError) redirect(`/projects/${projectId}/tasks/${taskId}?error=${encodeURIComponent(err.message)}`);
      throw err;
    }
  }

  async function handleDeleteTask() {
    "use server";
    const session = await auth();
    await deleteTask(taskId, session.user.workspaceId);
    redirect(`/projects/${projectId}`);
  }

  async function handleAddComment(formData) {
    "use server";
    const session = await auth();
    try {
      await addComment(taskId, session.user.workspaceId, session.user.id, { body: formData.get("body") });
      revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err) {
      if (err instanceof ValidationError) redirect(`/projects/${projectId}/tasks/${taskId}?error=${encodeURIComponent(err.message)}`);
      throw err;
    }
  }

  async function handleDeleteComment(commentId) {
    "use server";
    const session = await auth();
    try {
      await deleteComment(commentId, session.user.workspaceId, session.user.id);
      revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err) {
      if (err instanceof ValidationError) redirect(`/projects/${projectId}/tasks/${taskId}?error=${encodeURIComponent(err.message)}`);
      throw err;
    }
  }

  async function handleAddAttachment(formData) {
    "use server";
    const session = await auth();
    // uploadAttachment can throw a ValidationError (bad file) or a plain Error
    // (e.g. BLOB_READ_WRITE_TOKEN not configured) — both need a friendly
    // message here rather than crashing the page.
    let message = null;
    try {
      const uploaded = await uploadAttachment(formData.get("file"));
      await addAttachment(taskId, session.user.workspaceId, session.user.id, uploaded);
    } catch (err) {
      message = err instanceof ValidationError ? err.message : "Couldn't upload the file. Try again.";
    }
    if (message) {
      redirect(`/projects/${projectId}/tasks/${taskId}?error=${encodeURIComponent(message)}`);
    }
    revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  }

  async function handleDeleteAttachment(attachmentId) {
    "use server";
    const session = await auth();
    try {
      const attachment = await deleteAttachment(attachmentId, session.user.workspaceId, session.user.id);
      // Best-effort: the DB row is already gone either way, so a failure here
      // just means an orphaned file, not something worth surfacing to the user.
      await deleteAttachmentBlob(attachment.url).catch(() => {});
      revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err) {
      if (err instanceof ValidationError) redirect(`/projects/${projectId}/tasks/${taskId}?error=${encodeURIComponent(err.message)}`);
      throw err;
    }
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <Link href={`/projects/${projectId}`} className="text-faint" style={{ fontSize: "0.85rem" }}>&larr; {task.project.name}</Link>
          <h1 style={{ marginTop: 8 }}>{task.title}</h1>
        </div>
        <form action={handleDeleteTask}>
          <button type="submit" className="btn btn-danger btn-sm">Delete task</button>
        </form>
      </div>

      {errorMessage && <div className="notice notice-error">{errorMessage}</div>}

      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: task.description ? 16 : 0 }}>
          <span className={`pill ${PRIORITY_CLASS[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
          {task.dueDate && <span className="task-due">{formatDateTime(task.dueDate)}</span>}
          {task.assignee && (
            <span className="task-assignee">
              <span className="avatar-sm" style={{ width: 18, height: 18, fontSize: "0.6rem" }}>{task.assignee.name[0]}</span>
              {task.assignee.name}
            </span>
          )}
        </div>
        {task.description && <p className="text-muted">{task.description}</p>}

        <form action={handleUpdateStatus} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <select name="status" defaultValue={task.status} className="status-select" style={{ marginTop: 0 }}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">Update status</button>
        </form>
      </div>

      <div className="section-head" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Attachments</h2>
      </div>

      {task.attachments.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 16 }}>No attachments yet.</div>
      ) : (
        <div className="table-card" style={{ marginBottom: 16 }}>
          {task.attachments.map((attachment) => {
            const deleteForAttachment = handleDeleteAttachment.bind(null, attachment.id);
            const isOwn = attachment.uploaderId === session.user.id;
            return (
              <div key={attachment.id} className="economy-list-item">
                <div>
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.9rem" }}>
                    {attachment.filename}
                  </a>
                  <div className="text-faint" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                    {formatFileSize(attachment.size)} · {attachment.uploader?.name || "Removed member"} ·{" "}
                    {formatDateTime(attachment.createdAt)}
                  </div>
                </div>
                {isOwn && (
                  <form action={deleteForAttachment}>
                    <button type="submit" className="btn btn-danger btn-sm">Delete</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Add an attachment</h3>
        <form action={handleAddAttachment}>
          <div className="field">
            <label htmlFor="file">File</label>
            <input type="file" id="file" name="file" required />
          </div>
          <button type="submit" className="btn btn-primary">Upload</button>
        </form>
      </div>

      <div className="section-head" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Comments</h2>
      </div>

      {task.comments.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 16 }}>No comments yet.</div>
      ) : (
        <div className="table-card" style={{ marginBottom: 16 }}>
          {task.comments.map((comment) => {
            const deleteForComment = handleDeleteComment.bind(null, comment.id);
            const isOwn = comment.authorId === session.user.id;
            return (
              <div key={comment.id} className="economy-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.88rem" }}>{comment.author?.name || "Removed member"}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="text-faint" style={{ fontSize: "0.75rem" }}>{formatDateTime(comment.createdAt)}</span>
                    {isOwn && (
                      <form action={deleteForComment}>
                        <button type="submit" className="btn btn-danger btn-sm">Delete</button>
                      </form>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{comment.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Add a comment</h3>
        <form action={handleAddComment}>
          <div className="field">
            <label htmlFor="body">Comment</label>
            <textarea id="body" name="body" placeholder="Leave a note for the team..." required />
          </div>
          <button type="submit" className="btn btn-primary">Post comment</button>
        </form>
      </div>
    </div>
  );
}
