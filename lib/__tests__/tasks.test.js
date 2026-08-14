import { describe, it, expect, afterEach } from "vitest";
import { createTask, updateTaskStatus, updateTask, deleteTask } from "@/lib/tasks";
import { createProject, getProjectForWorkspace } from "@/lib/projects";
import { ValidationError, joinWorkspaceViaInvite } from "@/lib/workspace";
import { makeTenant, cleanupWorkspace, uniqueEmail } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

async function makeTenantWithProject(label) {
  const { workspace, user } = await makeTenant(label);
  const project = await createProject(workspace.id, { name: `${label} project` });
  return { workspace, user, project };
}

describe("createTask", () => {
  it("creates a task on a project within the workspace", async () => {
    const { workspace, project } = await makeTenantWithProject("task-create");
    createdWorkspaceIds.push(workspace.id);

    const task = await createTask(workspace.id, project.id, { title: "Write docs", priority: "HIGH" });
    expect(task.title).toBe("Write docs");
    expect(task.status).toBe("TODO");
    expect(task.priority).toBe("HIGH");
  });

  it("rejects an empty title", async () => {
    const { workspace, project } = await makeTenantWithProject("task-empty");
    createdWorkspaceIds.push(workspace.id);

    await expect(createTask(workspace.id, project.id, { title: "  " })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects creating a task on a project from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("task-cross-a");
    const { workspace: workspaceB, project: projectB } = await makeTenantWithProject("task-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(
      createTask(workspaceA.id, projectB.id, { title: "Sneaky task" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects assigning a task to a user outside the workspace", async () => {
    const { workspace: workspaceA, project: projectA } = await makeTenantWithProject("task-assignee-a");
    const { workspace: workspaceB, user: outsiderUser } = await makeTenant("task-assignee-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(
      createTask(workspaceA.id, projectA.id, { title: "Task", assigneeId: outsiderUser.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts an assignee who is a member of the workspace", async () => {
    const { workspace, project } = await makeTenantWithProject("task-assignee-ok");
    createdWorkspaceIds.push(workspace.id);
    const { user: member } = await joinWorkspaceViaInvite({
      name: "Assignee",
      email: uniqueEmail("assignee"),
      password: "correct-horse-battery",
      inviteCode: workspace.inviteCode,
    });

    const task = await createTask(workspace.id, project.id, { title: "Task", assigneeId: member.id });
    expect(task.assigneeId).toBe(member.id);
  });

  it("rejects an invalid due date", async () => {
    const { workspace, project } = await makeTenantWithProject("task-baddate");
    createdWorkspaceIds.push(workspace.id);

    await expect(
      createTask(workspace.id, project.id, { title: "Task", dueDate: "not-a-date" })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateTaskStatus", () => {
  it("updates a task's status", async () => {
    const { workspace, project } = await makeTenantWithProject("task-status");
    createdWorkspaceIds.push(workspace.id);
    const task = await createTask(workspace.id, project.id, { title: "Task" });

    const updated = await updateTaskStatus(task.id, workspace.id, "DONE");
    expect(updated.status).toBe("DONE");
  });

  it("rejects an invalid status value", async () => {
    const { workspace, project } = await makeTenantWithProject("task-status-invalid");
    createdWorkspaceIds.push(workspace.id);
    const task = await createTask(workspace.id, project.id, { title: "Task" });

    await expect(updateTaskStatus(task.id, workspace.id, "ARCHIVED")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects updating a task that belongs to another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("task-status-cross-a");
    const { workspace: workspaceB, project: projectB } = await makeTenantWithProject("task-status-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);
    const task = await createTask(workspaceB.id, projectB.id, { title: "Task" });

    await expect(updateTaskStatus(task.id, workspaceA.id, "DONE")).rejects.toBeInstanceOf(ValidationError);

    const project = await getProjectForWorkspace(projectB.id, workspaceB.id);
    expect(project.tasks.find((t) => t.id === task.id).status).toBe("TODO");
  });
});

describe("updateTask", () => {
  it("updates only the provided fields", async () => {
    const { workspace, project } = await makeTenantWithProject("task-update");
    createdWorkspaceIds.push(workspace.id);
    const task = await createTask(workspace.id, project.id, { title: "Original", priority: "LOW" });

    const updated = await updateTask(task.id, workspace.id, { priority: "HIGH" });
    expect(updated.title).toBe("Original");
    expect(updated.priority).toBe("HIGH");
  });

  it("can clear the due date by passing an empty value", async () => {
    const { workspace, project } = await makeTenantWithProject("task-cleardue");
    createdWorkspaceIds.push(workspace.id);
    const task = await createTask(workspace.id, project.id, { title: "Task", dueDate: "2026-01-01" });

    const updated = await updateTask(task.id, workspace.id, { dueDate: "" });
    expect(updated.dueDate).toBeNull();
  });
});

describe("deleteTask", () => {
  it("deletes a task in the caller's workspace", async () => {
    const { workspace, project } = await makeTenantWithProject("task-delete");
    createdWorkspaceIds.push(workspace.id);
    const task = await createTask(workspace.id, project.id, { title: "Task" });

    await deleteTask(task.id, workspace.id);

    const refreshed = await getProjectForWorkspace(project.id, workspace.id);
    expect(refreshed.tasks.find((t) => t.id === task.id)).toBeUndefined();
  });

  it("refuses to delete a task from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("task-delete-cross-a");
    const { workspace: workspaceB, project: projectB } = await makeTenantWithProject("task-delete-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);
    const task = await createTask(workspaceB.id, projectB.id, { title: "Task" });

    await expect(deleteTask(task.id, workspaceA.id)).rejects.toBeInstanceOf(ValidationError);

    const stillThere = await getProjectForWorkspace(projectB.id, workspaceB.id);
    expect(stillThere.tasks.find((t) => t.id === task.id)).toBeDefined();
  });
});
