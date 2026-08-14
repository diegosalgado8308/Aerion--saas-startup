import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/workspace";

const VALID_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

/**
 * Verifies the project belongs to the workspace before returning it.
 * Every task mutation below goes through this first — that's the
 * tenant-isolation boundary for tasks (a task's project has to be in
 * the caller's own workspace).
 */
async function requireProjectInWorkspace(projectId, workspaceId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.workspaceId !== workspaceId) {
    throw new ValidationError("Project not found.");
  }
  return project;
}

async function requireAssigneeInWorkspace(assigneeId, workspaceId) {
  if (!assigneeId) return null;
  const user = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!user || user.workspaceId !== workspaceId) {
    throw new ValidationError("Assignee not found in this workspace.");
  }
  return assigneeId;
}

export async function createTask(workspaceId, projectId, { title, description, priority, dueDate, assigneeId }) {
  await requireProjectInWorkspace(projectId, workspaceId);

  const cleanTitle = (title || "").toString().trim();
  if (!cleanTitle) throw new ValidationError("Task title is required.");

  const cleanPriority = VALID_PRIORITIES.includes(priority) ? priority : "MEDIUM";
  const cleanAssigneeId = await requireAssigneeInWorkspace(assigneeId, workspaceId);

  let cleanDueDate = null;
  if (dueDate) {
    const parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) throw new ValidationError("Invalid due date.");
    cleanDueDate = parsed;
  }

  return prisma.task.create({
    data: {
      title: cleanTitle,
      description: (description || "").toString().trim() || null,
      priority: cleanPriority,
      dueDate: cleanDueDate,
      assigneeId: cleanAssigneeId,
      projectId,
    },
  });
}

async function requireTaskInWorkspace(taskId, workspaceId) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task || task.project.workspaceId !== workspaceId) {
    throw new ValidationError("Task not found.");
  }
  return task;
}

/** Full task with project, assignee, and its comment thread, or null if not in this workspace. */
export async function getTaskForWorkspace(taskId, workspaceId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      assignee: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
        include: { uploader: { select: { id: true, name: true } } },
      },
    },
  });
  if (!task || task.project.workspaceId !== workspaceId) return null;
  return task;
}

export async function updateTaskStatus(taskId, workspaceId, status) {
  await requireTaskInWorkspace(taskId, workspaceId);
  if (!VALID_STATUSES.includes(status)) throw new ValidationError("Invalid status.");

  return prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function updateTask(taskId, workspaceId, { title, description, priority, dueDate, assigneeId, status }) {
  await requireTaskInWorkspace(taskId, workspaceId);

  const data = {};

  if (title !== undefined) {
    const cleanTitle = (title || "").toString().trim();
    if (!cleanTitle) throw new ValidationError("Task title is required.");
    data.title = cleanTitle;
  }
  if (description !== undefined) {
    data.description = (description || "").toString().trim() || null;
  }
  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) throw new ValidationError("Invalid priority.");
    data.priority = priority;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) throw new ValidationError("Invalid status.");
    data.status = status;
  }
  if (dueDate !== undefined) {
    if (!dueDate) {
      data.dueDate = null;
    } else {
      const parsed = new Date(dueDate);
      if (Number.isNaN(parsed.getTime())) throw new ValidationError("Invalid due date.");
      data.dueDate = parsed;
    }
  }
  if (assigneeId !== undefined) {
    data.assigneeId = await requireAssigneeInWorkspace(assigneeId, workspaceId);
  }

  return prisma.task.update({ where: { id: taskId }, data });
}

export async function deleteTask(taskId, workspaceId) {
  await requireTaskInWorkspace(taskId, workspaceId);
  await prisma.task.delete({ where: { id: taskId } });
}

const MAX_COMMENT_LENGTH = 4000;

export async function addComment(taskId, workspaceId, authorId, { body }) {
  await requireTaskInWorkspace(taskId, workspaceId);

  const cleanBody = (body || "").toString().trim();
  if (!cleanBody) throw new ValidationError("Comment can't be empty.");
  if (cleanBody.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
  }

  return prisma.comment.create({
    data: { body: cleanBody, taskId, authorId },
    include: { author: { select: { id: true, name: true } } },
  });
}

async function requireCommentInWorkspace(commentId, workspaceId) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: { include: { project: true } } },
  });
  if (!comment || comment.task.project.workspaceId !== workspaceId) {
    throw new ValidationError("Comment not found.");
  }
  return comment;
}

/** Only the comment's own author can delete it — not just any workspace member. */
export async function deleteComment(commentId, workspaceId, actingUserId) {
  const comment = await requireCommentInWorkspace(commentId, workspaceId);
  if (comment.authorId !== actingUserId) {
    throw new ValidationError("You can only delete your own comments.");
  }
  await prisma.comment.delete({ where: { id: commentId } });
}

const DUE_REMINDER_WINDOW_HOURS = 48;

/**
 * Tasks due within the reminder window that haven't been reminded about yet.
 * Global (not workspace-scoped) — this is meant for the cron job to sweep
 * every workspace in one pass, unlike everything else in this file. Each
 * task is reminded about at most once, ever — dueReminderSentAt is set the
 * first time and never cleared, so this is a one-shot heads-up, not a
 * repeating daily nag. No lower bound on dueDate: a task that's already
 * overdue and was never reminded about still matches (better a late
 * reminder than none), it just won't match a second time either.
 */
export async function getTasksDueForReminder({ now = new Date(), windowHours = DUE_REMINDER_WINDOW_HOURS } = {}) {
  const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

  return prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueReminderSentAt: null,
      assigneeId: { not: null },
      dueDate: { lte: windowEnd },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });
}

export async function markDueReminderSent(taskId) {
  await prisma.task.update({ where: { id: taskId }, data: { dueReminderSentAt: new Date() } });
}

/**
 * Batched form of markDueReminderSent — one UPDATE for every task reminded
 * about this run, instead of one per task. Used by the cron sweep, which can
 * process anywhere from zero to hundreds of due tasks in a single pass.
 */
export async function markManyDueRemindersSent(taskIds) {
  if (taskIds.length === 0) return;
  await prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { dueReminderSentAt: new Date() } });
}

/** Persists attachment metadata after the file has already been uploaded to Blob storage. */
export async function addAttachment(taskId, workspaceId, uploaderId, { filename, url, size }) {
  await requireTaskInWorkspace(taskId, workspaceId);

  return prisma.attachment.create({
    data: { filename, url, size, taskId, uploaderId },
    include: { uploader: { select: { id: true, name: true } } },
  });
}

async function requireAttachmentInWorkspace(attachmentId, workspaceId) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: { include: { project: true } } },
  });
  if (!attachment || attachment.task.project.workspaceId !== workspaceId) {
    throw new ValidationError("Attachment not found.");
  }
  return attachment;
}

/**
 * Only the uploader can delete their own attachment — mirrors deleteComment.
 * Deletes the DB row first, then returns the attachment so the caller can
 * clean up the underlying Blob file; if that second step fails, we're left
 * with an orphaned file but never a dangling DB reference, which is the
 * safer failure mode of the two.
 */
export async function deleteAttachment(attachmentId, workspaceId, actingUserId) {
  const attachment = await requireAttachmentInWorkspace(attachmentId, workspaceId);
  if (attachment.uploaderId !== actingUserId) {
    throw new ValidationError("You can only delete your own attachments.");
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  return attachment;
}
