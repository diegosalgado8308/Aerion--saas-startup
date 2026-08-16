import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/workspace";
import { runSimulation, analyzeBalance } from "@/lib/economy-simulation";
import { assertEconomyToolEntitlement } from "@/lib/billing";

export const NODE_TYPES = ["POOL", "SOURCE", "DRAIN", "CONVERTER"];
const MAX_NUMERIC_VALUE = 1_000_000_000;

// Practical memory budgets: runSimulation() allocates one time-series array
// per node, `steps` entries long (already capped at 500 in simulateDiagram
// below). Without a per-diagram ceiling on node/connection count, someone
// could keep adding nodes indefinitely — nothing here stopped that — and
// blow up simulation memory, SVG render cost (EconomyDiagramView.js), and
// the export endpoint's JSON payload all at once. These numbers are well
// past anything a human places by hand through the UI, while still keeping
// a worst-case simulation (200 nodes x 500 steps) bounded in the low tens
// of thousands of array slots — comfortably inside a Vercel Function's
// default memory limit, not just "probably fine."
const MAX_NODES_PER_DIAGRAM = 200;
const MAX_CONNECTIONS_PER_DIAGRAM = 500;

function parseNonNegative(value, fieldLabel, { allowNull = false } = {}) {
  if (allowNull && (value === undefined || value === "" || value === null)) return null;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0 || num > MAX_NUMERIC_VALUE) {
    throw new ValidationError(`${fieldLabel} must be a number between 0 and ${MAX_NUMERIC_VALUE.toLocaleString()}.`);
  }
  return num;
}

async function requireProjectInWorkspace(projectId, workspaceId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.workspaceId !== workspaceId) {
    throw new ValidationError("Project not found.");
  }
  return project;
}

async function requireDiagramInWorkspace(diagramId, workspaceId) {
  const diagram = await prisma.economyDiagram.findUnique({
    where: { id: diagramId },
    include: { project: true },
  });
  if (!diagram || diagram.project.workspaceId !== workspaceId) {
    throw new ValidationError("Diagram not found.");
  }
  return diagram;
}

async function requireNodeInWorkspace(nodeId, workspaceId) {
  const node = await prisma.economyNode.findUnique({
    where: { id: nodeId },
    include: { diagram: { include: { project: true } } },
  });
  if (!node || node.diagram.project.workspaceId !== workspaceId) {
    throw new ValidationError("Node not found.");
  }
  return node;
}

async function requireConnectionInWorkspace(connectionId, workspaceId) {
  const connection = await prisma.economyConnection.findUnique({
    where: { id: connectionId },
    include: { diagram: { include: { project: true } } },
  });
  if (!connection || connection.diagram.project.workspaceId !== workspaceId) {
    throw new ValidationError("Connection not found.");
  }
  return connection;
}

async function requireLayerInWorkspace(layerId, workspaceId) {
  const layer = await prisma.economyLayer.findUnique({
    where: { id: layerId },
    include: { diagram: { include: { project: true } } },
  });
  if (!layer || layer.diagram.project.workspaceId !== workspaceId) {
    throw new ValidationError("Layer not found.");
  }
  return layer;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function parseColor(color) {
  const clean = (color || "").toString().trim();
  if (!HEX_COLOR.test(clean)) {
    throw new ValidationError("Color must be a hex value like #6366f1.");
  }
  return clean;
}

/**
 * Validates a nullable layerId belongs to the given diagram before it's
 * attached to a node — the same "same-diagram" boundary addConnection
 * already enforces for from/to nodes.
 */
async function resolveNodeLayerId(diagramId, layerId) {
  if (layerId === undefined || layerId === "" || layerId === null) return null;
  const layer = await prisma.economyLayer.findUnique({ where: { id: layerId } });
  if (!layer || layer.diagramId !== diagramId) {
    throw new ValidationError("Layer not found in this diagram.");
  }
  return layerId;
}

export async function getDiagramsForProject(projectId, workspaceId) {
  await requireProjectInWorkspace(projectId, workspaceId);
  return prisma.economyDiagram.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { nodes: true, connections: true } } },
  });
}

export async function createDiagram(projectId, workspaceId, { name, description }) {
  await requireProjectInWorkspace(projectId, workspaceId);
  await assertEconomyToolEntitlement(workspaceId);
  const cleanName = (name || "").toString().trim();
  if (!cleanName) throw new ValidationError("Diagram name is required.");

  return prisma.economyDiagram.create({
    data: { name: cleanName, description: (description || "").toString().trim() || null, projectId },
  });
}

export async function deleteDiagram(diagramId, workspaceId) {
  await requireDiagramInWorkspace(diagramId, workspaceId);
  await prisma.economyDiagram.delete({ where: { id: diagramId } });
}

/** Full diagram with nodes + connections + layers, or null if it's not in this workspace. */
export async function getDiagramForWorkspace(diagramId, workspaceId) {
  const diagram = await prisma.economyDiagram.findUnique({
    where: { id: diagramId },
    include: {
      project: true,
      layers: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      nodes: { orderBy: { createdAt: "asc" }, include: { layer: true } },
      connections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!diagram || diagram.project.workspaceId !== workspaceId) return null;
  return diagram;
}

export async function addNode(diagramId, workspaceId, { name, type, resourceName, initialValue, capacity, layerId }) {
  await requireDiagramInWorkspace(diagramId, workspaceId);

  const nodeCount = await prisma.economyNode.count({ where: { diagramId } });
  if (nodeCount >= MAX_NODES_PER_DIAGRAM) {
    throw new ValidationError(`A diagram can have at most ${MAX_NODES_PER_DIAGRAM} nodes.`);
  }

  const cleanName = (name || "").toString().trim();
  if (!cleanName) throw new ValidationError("Node name is required.");
  if (!NODE_TYPES.includes(type)) throw new ValidationError("Invalid node type.");
  const cleanResource = (resourceName || "").toString().trim();
  if (!cleanResource) throw new ValidationError("Resource name is required.");

  const cleanInitial = parseNonNegative(initialValue === undefined || initialValue === "" ? 0 : initialValue, "Initial value");
  const cleanCapacity = parseNonNegative(capacity, "Capacity", { allowNull: true });
  const cleanLayerId = await resolveNodeLayerId(diagramId, layerId);

  return prisma.economyNode.create({
    data: {
      name: cleanName,
      type,
      resourceName: cleanResource,
      initialValue: cleanInitial,
      capacity: cleanCapacity,
      layerId: cleanLayerId,
      diagramId,
    },
  });
}

export async function updateNode(nodeId, workspaceId, { initialValue, capacity, layerId }) {
  const node = await requireNodeInWorkspace(nodeId, workspaceId);
  const data = {};
  if (initialValue !== undefined) data.initialValue = parseNonNegative(initialValue, "Initial value");
  if (capacity !== undefined) data.capacity = parseNonNegative(capacity, "Capacity", { allowNull: true });
  if (layerId !== undefined) data.layerId = await resolveNodeLayerId(node.diagramId, layerId);
  return prisma.economyNode.update({ where: { id: nodeId }, data });
}

export async function deleteNode(nodeId, workspaceId) {
  await requireNodeInWorkspace(nodeId, workspaceId);
  await prisma.economyNode.delete({ where: { id: nodeId } });
}

export async function addConnection(diagramId, workspaceId, { fromNodeId, toNodeId, rate, rateVariance }) {
  await requireDiagramInWorkspace(diagramId, workspaceId);

  const connectionCount = await prisma.economyConnection.count({ where: { diagramId } });
  if (connectionCount >= MAX_CONNECTIONS_PER_DIAGRAM) {
    throw new ValidationError(`A diagram can have at most ${MAX_CONNECTIONS_PER_DIAGRAM} connections.`);
  }

  if (!fromNodeId || !toNodeId) throw new ValidationError("Both a source and destination node are required.");
  if (fromNodeId === toNodeId) throw new ValidationError("A connection can't go from a node to itself.");

  const [fromNode, toNode] = await Promise.all([
    prisma.economyNode.findUnique({ where: { id: fromNodeId } }),
    prisma.economyNode.findUnique({ where: { id: toNodeId } }),
  ]);
  if (!fromNode || fromNode.diagramId !== diagramId) throw new ValidationError("Source node not found in this diagram.");
  if (!toNode || toNode.diagramId !== diagramId) throw new ValidationError("Destination node not found in this diagram.");
  if (toNode.type === "SOURCE") throw new ValidationError("A Source node can't be a connection's destination.");
  if (fromNode.type === "DRAIN") throw new ValidationError("A Drain node can't be a connection's source.");

  const cleanRate = parseNonNegative(rate, "Rate");
  const cleanVariance = parseNonNegative(rateVariance === undefined || rateVariance === "" ? 0 : rateVariance, "Rate variance");

  return prisma.economyConnection.create({
    data: { diagramId, fromNodeId, toNodeId, rate: cleanRate, rateVariance: cleanVariance },
  });
}

export async function updateConnection(connectionId, workspaceId, { rate, rateVariance }) {
  await requireConnectionInWorkspace(connectionId, workspaceId);
  const data = {};
  if (rate !== undefined) data.rate = parseNonNegative(rate, "Rate");
  if (rateVariance !== undefined) {
    data.rateVariance = parseNonNegative(rateVariance === "" ? 0 : rateVariance, "Rate variance");
  }
  return prisma.economyConnection.update({ where: { id: connectionId }, data });
}

export async function deleteConnection(connectionId, workspaceId) {
  await requireConnectionInWorkspace(connectionId, workspaceId);
  await prisma.economyConnection.delete({ where: { id: connectionId } });
}

export async function createLayer(diagramId, workspaceId, { name, color }) {
  await requireDiagramInWorkspace(diagramId, workspaceId);

  const cleanName = (name || "").toString().trim();
  if (!cleanName) throw new ValidationError("Layer name is required.");
  const cleanColor = color ? parseColor(color) : "#6366f1";

  const count = await prisma.economyLayer.count({ where: { diagramId } });

  return prisma.economyLayer.create({
    data: { name: cleanName, color: cleanColor, order: count, diagramId },
  });
}

export async function updateLayer(layerId, workspaceId, { name, color }) {
  await requireLayerInWorkspace(layerId, workspaceId);
  const data = {};
  if (name !== undefined) {
    const cleanName = (name || "").toString().trim();
    if (!cleanName) throw new ValidationError("Layer name is required.");
    data.name = cleanName;
  }
  if (color !== undefined) data.color = parseColor(color);
  return prisma.economyLayer.update({ where: { id: layerId }, data });
}

/** Deleting a layer un-assigns its nodes (onDelete: SetNull) rather than deleting them. */
export async function deleteLayer(layerId, workspaceId) {
  await requireLayerInWorkspace(layerId, workspaceId);
  await prisma.economyLayer.delete({ where: { id: layerId } });
}

export async function simulateDiagram(diagramId, workspaceId, { steps } = {}) {
  const diagram = await getDiagramForWorkspace(diagramId, workspaceId);
  if (!diagram) throw new ValidationError("Diagram not found.");
  if (diagram.nodes.length === 0) throw new ValidationError("Add at least one node before simulating.");

  const safeSteps = Math.min(500, Math.max(1, Math.floor(Number(steps)) || 20));
  const result = runSimulation({ nodes: diagram.nodes, connections: diagram.connections, steps: safeSteps });
  const balance = analyzeBalance({ nodes: diagram.nodes, connections: diagram.connections, ...result });

  return { diagram, ...result, balance };
}
