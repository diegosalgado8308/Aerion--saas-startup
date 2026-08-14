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
