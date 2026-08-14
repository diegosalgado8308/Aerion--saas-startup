import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/workspace";

const PROJECTS_PAGE_SIZE = 20;
const TASKS_PER_PROJECT_LIMIT = 500;

/**
 * Paginated so a workspace with hundreds of projects doesn't fetch (or
 * render) them all at once.
 */
export async function getProjects(workspaceId, { page = 1, pageSize = PROJECTS_PAGE_SIZE } = {}) {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || PROJECTS_PAGE_SIZE));

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tasks: true } } },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.project.count({ where: { workspaceId } }),
  ]);

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

/**
 * Fetches a project's tasks, but only if the project actually belongs to
 * the given workspace — this is the tenant-isolation boundary. Returns
 * null rather than throwing so callers can 404 cleanly.
 *
 * Tasks are capped at `taskLimit` so a project that accumulates thousands
 * of tasks over time can't blow up the query or the rendered board;
 * `taskTotal` on the result tells the caller whether it was truncated.
 */
export async function getProjectForWorkspace(projectId, workspaceId, { taskLimit = TASKS_PER_PROJECT_LIMIT } = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        orderBy: { createdAt: "asc" },
        take: taskLimit,
        include: { assignee: { select: { id: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });

  if (!project || project.workspaceId !== workspaceId) return null;

  return {
    ...project,
    taskTotal: project._count.tasks,
    tasksTruncated: project._count.tasks > project.tasks.length,
  };
}

/** Lightweight lookup (no tasks) for pages that only need the project's own fields. */
export async function getProjectMeta(projectId, workspaceId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.workspaceId !== workspaceId) return null;
  return project;
}

export async function createProject(workspaceId, { name, description }) {
  const cleanName = (name || "").toString().trim();
  if (!cleanName) throw new ValidationError("Project name is required.");

  return prisma.project.create({
    data: {
      name: cleanName,
      description: (description || "").toString().trim() || null,
      workspaceId,
    },
  });
}

export async function deleteProject(projectId, workspaceId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.workspaceId !== workspaceId) {
    throw new ValidationError("Project not found.");
  }
  await prisma.project.delete({ where: { id: projectId } });
}
