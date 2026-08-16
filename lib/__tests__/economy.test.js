import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/projects";
import { ValidationError } from "@/lib/workspace";
import {
  createDiagram,
  deleteDiagram,
  getDiagramsForProject,
  getDiagramForWorkspace,
  addNode,
  updateNode,
  deleteNode,
  addConnection,
  updateConnection,
  deleteConnection,
  simulateDiagram,
  createLayer,
  updateLayer,
  deleteLayer,
} from "@/lib/economy";
import { makeTenant, cleanupWorkspace } from "./helpers";

const createdWorkspaceIds = [];

afterEach(async () => {
  while (createdWorkspaceIds.length) {
    await cleanupWorkspace(createdWorkspaceIds.pop());
  }
});

/**
 * The economy tool is a paid-plan feature as of lib/billing.js's
 * assertEconomyToolEntitlement — this file's tests exercise diagram/node/
 * connection logic itself, not billing gating (see lib/__tests__/billing.test.js
 * for that), so every tenant here needs a plan that includes the tool.
 */
async function upgradeToBusinessPlan(workspaceId) {
  await prisma.workspace.update({ where: { id: workspaceId }, data: { plan: "BUSINESS", subscriptionStatus: "active" } });
}

async function makeTenantWithDiagram(label) {
  const { workspace, user } = await makeTenant(label);
  await upgradeToBusinessPlan(workspace.id);
  const project = await createProject(workspace.id, { name: `${label} project` });
  const diagram = await createDiagram(project.id, workspace.id, { name: `${label} diagram` });
  return { workspace, user, project, diagram };
}

describe("createDiagram", () => {
  it("creates a diagram scoped to the project's workspace", async () => {
    const { workspace, project } = await (async () => {
      const t = await makeTenant("diag-create");
      await upgradeToBusinessPlan(t.workspace.id);
      const p = await createProject(t.workspace.id, { name: "P" });
      return { workspace: t.workspace, project: p };
    })();
    createdWorkspaceIds.push(workspace.id);

    const diagram = await createDiagram(project.id, workspace.id, { name: "Economy v1" });
    expect(diagram.projectId).toBe(project.id);
  });

  it("rejects creating a diagram on a project from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("diag-cross-a");
    await upgradeToBusinessPlan(workspaceA.id);
    const { workspace: workspaceB, project: projectB } = await (async () => {
      const t = await makeTenant("diag-cross-b");
      const p = await createProject(t.workspace.id, { name: "P" });
      return { workspace: t.workspace, project: p };
    })();
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(createDiagram(projectB.id, workspaceA.id, { name: "Sneaky" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an empty name", async () => {
    const t = await makeTenant("diag-empty");
    await upgradeToBusinessPlan(t.workspace.id);
    const project = await createProject(t.workspace.id, { name: "P" });
    createdWorkspaceIds.push(t.workspace.id);

    await expect(createDiagram(project.id, t.workspace.id, { name: "  " })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("tenant isolation for diagrams", () => {
  it("getDiagramForWorkspace returns null across workspaces", async () => {
    const { workspace: workspaceA } = await makeTenant("diag-iso-a");
    const { workspace: workspaceB, diagram: diagramB } = await makeTenantWithDiagram("diag-iso-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    expect(await getDiagramForWorkspace(diagramB.id, workspaceA.id)).toBeNull();
  });

  it("deleteDiagram refuses cross-workspace deletion", async () => {
    const { workspace: workspaceA } = await makeTenant("diag-del-a");
    const { workspace: workspaceB, diagram: diagramB } = await makeTenantWithDiagram("diag-del-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(deleteDiagram(diagramB.id, workspaceA.id)).rejects.toBeInstanceOf(ValidationError);
    expect(await getDiagramForWorkspace(diagramB.id, workspaceB.id)).not.toBeNull();
  });
});

describe("addNode", () => {
  it("adds a valid node", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-add");
    createdWorkspaceIds.push(workspace.id);

    const node = await addNode(diagram.id, workspace.id, {
      name: "Gold Pool", type: "POOL", resourceName: "Gold", initialValue: 100, capacity: 500,
    });
    expect(node.type).toBe("POOL");
    expect(node.initialValue).toBe(100);
    expect(node.capacity).toBe(500);
  });

  it("rejects an invalid node type", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-badtype");
    createdWorkspaceIds.push(workspace.id);

    await expect(
      addNode(diagram.id, workspace.id, { name: "X", type: "BLACK_HOLE", resourceName: "Gold" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a negative initial value", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-neg");
    createdWorkspaceIds.push(workspace.id);

    await expect(
      addNode(diagram.id, workspace.id, { name: "X", type: "POOL", resourceName: "Gold", initialValue: -5 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects adding a node to a diagram from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("node-cross-a");
    const { workspace: workspaceB, diagram: diagramB } = await makeTenantWithDiagram("node-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);

    await expect(
      addNode(diagramB.id, workspaceA.id, { name: "X", type: "POOL", resourceName: "Gold" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a node past the per-diagram cap (practical memory budget)", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-cap");
    createdWorkspaceIds.push(workspace.id);

    // Bulk-insert directly at the cap — fast setup, not itself under test.
    // The real addNode() call below is what's actually being verified.
    await prisma.economyNode.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        name: `Filler ${i}`, type: "POOL", resourceName: "Gold", diagramId: diagram.id,
      })),
    });

    await expect(
      addNode(diagram.id, workspace.id, { name: "One too many", type: "POOL", resourceName: "Gold" })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateNode / deleteNode", () => {
  it("updates a node's tunable values", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-update");
    createdWorkspaceIds.push(workspace.id);
    const node = await addNode(diagram.id, workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", initialValue: 10 });

    const updated = await updateNode(node.id, workspace.id, { initialValue: 50, capacity: 200 });
    expect(updated.initialValue).toBe(50);
    expect(updated.capacity).toBe(200);
  });

  it("refuses to update a node from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("node-update-cross-a");
    const { workspace: workspaceB, diagram: diagramB } = await makeTenantWithDiagram("node-update-cross-b");
    createdWorkspaceIds.push(workspaceA.id, workspaceB.id);
    const node = await addNode(diagramB.id, workspaceB.id, { name: "Pool", type: "POOL", resourceName: "Gold" });

    await expect(updateNode(node.id, workspaceA.id, { initialValue: 999 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("deletes a node", async () => {
    const { workspace, diagram } = await makeTenantWithDiagram("node-delete");
    createdWorkspaceIds.push(workspace.id);
    const node = await addNode(diagram.id, workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });

    await deleteNode(node.id, workspace.id);
    const refreshed = await getDiagramForWorkspace(diagram.id, workspace.id);
    expect(refreshed.nodes).toHaveLength(0);
  });
});

describe("addConnection", () => {
  async function withTwoNodes(label) {
    const t = await makeTenantWithDiagram(label);
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    const drain = await addNode(t.diagram.id, t.workspace.id, { name: "Drain", type: "DRAIN", resourceName: "Gold" });
    return { ...t, source, pool, drain };
  }

  it("connects two nodes in the same diagram", async () => {
    const t = await withTwoNodes("conn-add");
    createdWorkspaceIds.push(t.workspace.id);

    const connection = await addConnection(t.diagram.id, t.workspace.id, {
      fromNodeId: t.source.id, toNodeId: t.pool.id, rate: 5,
    });
    expect(connection.rate).toBe(5);
    expect(connection.rateVariance).toBe(0);
  });

  it("rejects a self-loop", async () => {
    const t = await withTwoNodes("conn-self");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      addConnection(t.diagram.id, t.workspace.id, { fromNodeId: t.pool.id, toNodeId: t.pool.id, rate: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a Source as a destination", async () => {
    const t = await withTwoNodes("conn-src-dest");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      addConnection(t.diagram.id, t.workspace.id, { fromNodeId: t.pool.id, toNodeId: t.source.id, rate: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a Drain as a source", async () => {
    const t = await withTwoNodes("conn-drain-src");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      addConnection(t.diagram.id, t.workspace.id, { fromNodeId: t.drain.id, toNodeId: t.pool.id, rate: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a node from a different diagram", async () => {
    const t = await withTwoNodes("conn-otherdiagram");
    const otherDiagram = await createDiagram(t.project.id, t.workspace.id, { name: "Other diagram" });
    const otherNode = await addNode(otherDiagram.id, t.workspace.id, { name: "Other", type: "POOL", resourceName: "Gold" });
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      addConnection(t.diagram.id, t.workspace.id, { fromNodeId: t.source.id, toNodeId: otherNode.id, rate: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a connection past the per-diagram cap (practical memory budget)", async () => {
    const t = await withTwoNodes("conn-cap");
    createdWorkspaceIds.push(t.workspace.id);

    // Bulk-insert directly at the cap — fast setup, not itself under test.
    // The real addConnection() call below is what's actually being verified.
    await prisma.economyConnection.createMany({
      data: Array.from({ length: 500 }, () => ({
        diagramId: t.diagram.id, fromNodeId: t.source.id, toNodeId: t.pool.id, rate: 1,
      })),
    });

    await expect(
      addConnection(t.diagram.id, t.workspace.id, { fromNodeId: t.source.id, toNodeId: t.drain.id, rate: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateConnection / deleteConnection", () => {
  it("updates rate and variance", async () => {
    const t = await makeTenantWithDiagram("conn-update");
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    const connection = await addConnection(t.diagram.id, t.workspace.id, { fromNodeId: source.id, toNodeId: pool.id, rate: 5 });
    createdWorkspaceIds.push(t.workspace.id);

    const updated = await updateConnection(connection.id, t.workspace.id, { rate: 20, rateVariance: 3 });
    expect(updated.rate).toBe(20);
    expect(updated.rateVariance).toBe(3);
  });

  it("refuses cross-workspace connection updates", async () => {
    const { workspace: workspaceA } = await makeTenant("conn-update-cross-a");
    const t = await makeTenantWithDiagram("conn-update-cross-b");
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    const connection = await addConnection(t.diagram.id, t.workspace.id, { fromNodeId: source.id, toNodeId: pool.id, rate: 5 });
    createdWorkspaceIds.push(workspaceA.id, t.workspace.id);

    await expect(updateConnection(connection.id, workspaceA.id, { rate: 999 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("deleting a connection doesn't delete its nodes", async () => {
    const t = await makeTenantWithDiagram("conn-delete");
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    const connection = await addConnection(t.diagram.id, t.workspace.id, { fromNodeId: source.id, toNodeId: pool.id, rate: 5 });
    createdWorkspaceIds.push(t.workspace.id);

    await deleteConnection(connection.id, t.workspace.id);
    const refreshed = await getDiagramForWorkspace(t.diagram.id, t.workspace.id);
    expect(refreshed.connections).toHaveLength(0);
    expect(refreshed.nodes).toHaveLength(2);
  });
});

describe("simulateDiagram", () => {
  it("runs a simulation against the stored diagram", async () => {
    const t = await makeTenantWithDiagram("sim-run");
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", initialValue: 0 });
    await addConnection(t.diagram.id, t.workspace.id, { fromNodeId: source.id, toNodeId: pool.id, rate: 10 });
    createdWorkspaceIds.push(t.workspace.id);

    const result = await simulateDiagram(t.diagram.id, t.workspace.id, { steps: 3 });
    expect(result.series[pool.id]).toEqual([0, 10, 20, 30]);
  });

  it("rejects simulating a diagram with no nodes", async () => {
    const t = await makeTenantWithDiagram("sim-empty");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(simulateDiagram(t.diagram.id, t.workspace.id, { steps: 5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to simulate a diagram from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("sim-cross-a");
    const t = await makeTenantWithDiagram("sim-cross-b");
    await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    createdWorkspaceIds.push(workspaceA.id, t.workspace.id);

    await expect(simulateDiagram(t.diagram.id, workspaceA.id, { steps: 5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("clamps an absurd step count to the safety cap", async () => {
    const t = await makeTenantWithDiagram("sim-cap");
    const source = await addNode(t.diagram.id, t.workspace.id, { name: "Src", type: "SOURCE", resourceName: "Gold" });
    const pool = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold" });
    await addConnection(t.diagram.id, t.workspace.id, { fromNodeId: source.id, toNodeId: pool.id, rate: 1 });
    createdWorkspaceIds.push(t.workspace.id);

    const result = await simulateDiagram(t.diagram.id, t.workspace.id, { steps: 999999 });
    expect(result.steps).toBe(500);
  });
});

describe("createLayer", () => {
  it("creates a layer with a default color when none is given", async () => {
    const t = await makeTenantWithDiagram("layer-create");
    createdWorkspaceIds.push(t.workspace.id);

    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Core Loop" });
    expect(layer.name).toBe("Core Loop");
    expect(layer.color).toBe("#6366f1");
  });

  it("accepts a custom hex color", async () => {
    const t = await makeTenantWithDiagram("layer-color");
    createdWorkspaceIds.push(t.workspace.id);

    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Monetization", color: "#e5484d" });
    expect(layer.color).toBe("#e5484d");
  });

  it("rejects an invalid hex color", async () => {
    const t = await makeTenantWithDiagram("layer-badcolor");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      createLayer(t.diagram.id, t.workspace.id, { name: "Bad", color: "not-a-color" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an empty name", async () => {
    const t = await makeTenantWithDiagram("layer-empty");
    createdWorkspaceIds.push(t.workspace.id);

    await expect(createLayer(t.diagram.id, t.workspace.id, { name: "  " })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects creating a layer on a diagram from another workspace", async () => {
    const { workspace: workspaceA } = await makeTenant("layer-cross-a");
    const t = await makeTenantWithDiagram("layer-cross-b");
    createdWorkspaceIds.push(workspaceA.id, t.workspace.id);

    await expect(
      createLayer(t.diagram.id, workspaceA.id, { name: "Sneaky" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("assigns increasing order values as layers are added", async () => {
    const t = await makeTenantWithDiagram("layer-order");
    createdWorkspaceIds.push(t.workspace.id);

    const first = await createLayer(t.diagram.id, t.workspace.id, { name: "First" });
    const second = await createLayer(t.diagram.id, t.workspace.id, { name: "Second" });
    expect(second.order).toBeGreaterThan(first.order);
  });
});

describe("updateLayer / deleteLayer", () => {
  it("renames and recolors a layer", async () => {
    const t = await makeTenantWithDiagram("layer-update");
    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Old Name" });
    createdWorkspaceIds.push(t.workspace.id);

    const updated = await updateLayer(layer.id, t.workspace.id, { name: "New Name", color: "#3fbf82" });
    expect(updated.name).toBe("New Name");
    expect(updated.color).toBe("#3fbf82");
  });

  it("refuses cross-workspace layer updates", async () => {
    const { workspace: workspaceA } = await makeTenant("layer-update-cross-a");
    const t = await makeTenantWithDiagram("layer-update-cross-b");
    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Layer" });
    createdWorkspaceIds.push(workspaceA.id, t.workspace.id);

    await expect(updateLayer(layer.id, workspaceA.id, { name: "Hijacked" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("deleting a layer un-assigns its nodes rather than deleting them", async () => {
    const t = await makeTenantWithDiagram("layer-delete");
    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Layer" });
    const node = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", layerId: layer.id });
    createdWorkspaceIds.push(t.workspace.id);

    await deleteLayer(layer.id, t.workspace.id);

    const refreshed = await getDiagramForWorkspace(t.diagram.id, t.workspace.id);
    expect(refreshed.layers).toHaveLength(0);
    const refreshedNode = refreshed.nodes.find((n) => n.id === node.id);
    expect(refreshedNode.layerId).toBeNull();
  });
});

describe("node layer assignment", () => {
  it("assigns a node to a layer at creation time", async () => {
    const t = await makeTenantWithDiagram("node-layer-create");
    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Core Loop" });
    createdWorkspaceIds.push(t.workspace.id);

    const node = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", layerId: layer.id });
    expect(node.layerId).toBe(layer.id);
  });

  it("rejects assigning a node to a layer from a different diagram", async () => {
    const t = await makeTenantWithDiagram("node-layer-cross");
    const otherDiagram = await createDiagram(t.project.id, t.workspace.id, { name: "Other diagram" });
    const otherLayer = await createLayer(otherDiagram.id, t.workspace.id, { name: "Other layer" });
    createdWorkspaceIds.push(t.workspace.id);

    await expect(
      addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", layerId: otherLayer.id })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("reassigns a node's layer via updateNode", async () => {
    const t = await makeTenantWithDiagram("node-layer-update");
    const layerA = await createLayer(t.diagram.id, t.workspace.id, { name: "A" });
    const layerB = await createLayer(t.diagram.id, t.workspace.id, { name: "B" });
    const node = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", layerId: layerA.id });
    createdWorkspaceIds.push(t.workspace.id);

    const updated = await updateNode(node.id, t.workspace.id, { layerId: layerB.id });
    expect(updated.layerId).toBe(layerB.id);
  });

  it("clears a node's layer by passing an empty value", async () => {
    const t = await makeTenantWithDiagram("node-layer-clear");
    const layer = await createLayer(t.diagram.id, t.workspace.id, { name: "Layer" });
    const node = await addNode(t.diagram.id, t.workspace.id, { name: "Pool", type: "POOL", resourceName: "Gold", layerId: layer.id });
    createdWorkspaceIds.push(t.workspace.id);

    const updated = await updateNode(node.id, t.workspace.id, { layerId: "" });
    expect(updated.layerId).toBeNull();
  });
});
