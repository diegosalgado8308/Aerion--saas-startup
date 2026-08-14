import { describe, it, expect, afterEach } from "vitest";
import { createProject, getProjects, getProjectForWorkspace, deleteProject } from "@/lib/projects";
import { ValidationError } from "@/lib/workspace";
import { makeTenant, cleanupWorkspace } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

describe("createProject", () => {
  it("creates a project scoped to the workspace", async () => {
    const { workspace } = await makeTenant("proj-create");
    createdWorkspaceIds.push(workspace.id);

    const project = await createProject(workspace.id, { name: "Launch", description: "Ship it" });
    expect(project.workspaceId).toBe(workspace.id);
    expect(project.name).toBe("Launch");
  });

  it("rejects an empty name", async () => {
    const { workspace } = await makeTenant("proj-empty");
    createdWorkspaceIds.push(workspace.id);

    await expect(createProject(workspace.id, { name: "   " })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("tenant isolation", () => {
  it("getProjects only returns the requesting workspace's projects", async () => {
    const { workspace: workspaceA } = await makeTenant("proj-iso-a");
    const { workspace: workspaceB } = await makeTenant("proj-iso-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    const projectA = await createProject(workspaceA.id, { name: "A project" });
    await createProject(workspaceB.id, { name: "B project" });

    const listA = await getProjects(workspaceA.id);
    expect(listA.items.map((p) => p.id)).toEqual([projectA.id]);
    expect(listA.total).toBe(1);
  });

  it("getProjectForWorkspace returns null for a project belonging to another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("proj-cross-a");
    const { workspace: workspaceB } = await makeTenant("proj-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    const projectB = await createProject(workspaceB.id, { name: "B project" });

    const result = await getProjectForWorkspace(projectB.id, workspaceA.id);
    expect(result).toBeNull();
  });

  it("deleteProject refuses to delete a project from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("proj-del-a");
    const { workspace: workspaceB } = await makeTenant("proj-del-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    const projectB = await createProject(workspaceB.id, { name: "B project" });

    await expect(deleteProject(projectB.id, workspaceA.id)).rejects.toBeInstanceOf(ValidationError);

    const stillThere = await getProjectForWorkspace(projectB.id, workspaceB.id);
    expect(stillThere).not.toBeNull();
  });
});

describe("getProjects pagination", () => {
  it("paginates results and reports correct totals", async () => {
    const { workspace } = await makeTenant("proj-page");
    createdWorkspaceIds.push(workspace.id);

    for (let i = 0; i < 5; i += 1) {
      await createProject(workspace.id, { name: `Project ${i}` });
    }

    const page1 = await getProjects(workspace.id, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);

    const page2 = await getProjects(workspace.id, { page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(2);

    const page3 = await getProjects(workspace.id, { page: 3, pageSize: 2 });
    expect(page3.items).toHaveLength(1);

    // No overlap between pages
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((p) => p.id);
    expect(new Set(allIds).size).toBe(5);
  });

  it("clamps an out-of-range page instead of erroring", async () => {
    const { workspace } = await makeTenant("proj-page-oob");
    createdWorkspaceIds.push(workspace.id);
    await createProject(workspace.id, { name: "Only project" });

    const farPage = await getProjects(workspace.id, { page: 999, pageSize: 10 });
    expect(farPage.items).toHaveLength(0);
    expect(farPage.total).toBe(1);
  });
});

describe("getProjectForWorkspace task cap", () => {
  it("caps returned tasks and reports truncation", async () => {
    const { workspace, project } = await (async () => {
      const t = await makeTenant("proj-cap");
      const p = await createProject(t.workspace.id, { name: "Big project" });
      return { workspace: t.workspace, project: p };
    })();
    createdWorkspaceIds.push(workspace.id);

    const { createTask } = await import("@/lib/tasks");
    for (let i = 0; i < 6; i += 1) {
      await createTask(workspace.id, project.id, { title: `Task ${i}` });
    }

    const capped = await getProjectForWorkspace(project.id, workspace.id, { taskLimit: 4 });
    expect(capped.tasks).toHaveLength(4);
    expect(capped.taskTotal).toBe(6);
    expect(capped.tasksTruncated).toBe(true);

    const uncapped = await getProjectForWorkspace(project.id, workspace.id, { taskLimit: 100 });
    expect(uncapped.tasks).toHaveLength(6);
    expect(uncapped.tasksTruncated).toBe(false);
  });
});
