import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getDiagramForWorkspace,
  deleteDiagram,
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
  NODE_TYPES,
} from "@/lib/economy";
import { ValidationError } from "@/lib/workspace";
import EconomyDiagramView, { ECONOMY_TYPE_COLOR } from "@/components/EconomyDiagramView";
import SimulationChart from "@/components/SimulationChart";
import BalanceReport from "@/components/BalanceReport";
import DiagramExportButtons from "@/components/DiagramExportButtons";

export async function generateMetadata({ params }) {
  const { diagramId } = await params;
  const session = await auth();
  const diagram = await getDiagramForWorkspace(diagramId, session.user.workspaceId);
  return { title: diagram?.name || "Diagram" };
}

function backTo(projectId, diagramId, extra = "") {
  return `/projects/${projectId}/economy/${diagramId}${extra}`;
}

async function handleAddNode(diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await addNode(diagramId, session.user.workspaceId, {
      name: formData.get("name"),
      type: formData.get("type"),
      resourceName: formData.get("resourceName"),
      initialValue: formData.get("initialValue"),
      capacity: formData.get("capacity"),
      layerId: formData.get("layerId") || null,
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleUpdateNode(nodeId, diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await updateNode(nodeId, session.user.workspaceId, {
      initialValue: formData.get("initialValue"),
      capacity: formData.get("capacity"),
      layerId: formData.get("layerId") || null,
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleDeleteNode(nodeId, diagramId, projectId) {
  "use server";
  const session = await auth();
  await deleteNode(nodeId, session.user.workspaceId);
  revalidatePath(backTo(projectId, diagramId));
}

async function handleAddConnection(diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await addConnection(diagramId, session.user.workspaceId, {
      fromNodeId: formData.get("fromNodeId"),
      toNodeId: formData.get("toNodeId"),
      rate: formData.get("rate"),
      rateVariance: formData.get("rateVariance"),
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleUpdateConnection(connectionId, diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await updateConnection(connectionId, session.user.workspaceId, {
      rate: formData.get("rate"),
      rateVariance: formData.get("rateVariance"),
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleDeleteConnection(connectionId, diagramId, projectId) {
  "use server";
  const session = await auth();
  await deleteConnection(connectionId, session.user.workspaceId);
  revalidatePath(backTo(projectId, diagramId));
}

async function handleDeleteDiagram(diagramId, projectId) {
  "use server";
  const session = await auth();
  await deleteDiagram(diagramId, session.user.workspaceId);
  redirect(`/projects/${projectId}/economy`);
}

async function handleAddLayer(diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await createLayer(diagramId, session.user.workspaceId, {
      name: formData.get("name"),
      color: formData.get("color"),
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleUpdateLayer(layerId, diagramId, projectId, formData) {
  "use server";
  const session = await auth();
  try {
    await updateLayer(layerId, session.user.workspaceId, {
      name: formData.get("name"),
      color: formData.get("color"),
    });
    revalidatePath(backTo(projectId, diagramId));
  } catch (err) {
    if (err instanceof ValidationError) redirect(backTo(projectId, diagramId, `?error=${encodeURIComponent(err.message)}`));
    throw err;
  }
}

async function handleDeleteLayer(layerId, diagramId, projectId) {
  "use server";
  const session = await auth();
  await deleteLayer(layerId, session.user.workspaceId);
  revalidatePath(backTo(projectId, diagramId));
}

export default async function EconomyDiagramPage({ params, searchParams }) {
  const { id: projectId, diagramId } = await params;
  const session = await auth();
  const sp = await searchParams;
  const errorMessage = sp?.error ? decodeURIComponent(sp.error) : null;

  const diagram = await getDiagramForWorkspace(diagramId, session.user.workspaceId);
  if (!diagram || diagram.projectId !== projectId) notFound();

  const requestedSteps = parseInt(sp?.steps, 10);
  const hasSimRequest = Number.isInteger(requestedSteps) && requestedSteps > 0;
  let simResult = null;
  let simError = null;
  if (hasSimRequest) {
    try {
      simResult = await simulateDiagram(diagramId, session.user.workspaceId, { steps: requestedSteps });
    } catch (err) {
      if (err instanceof ValidationError) simError = err.message;
      else throw err;
    }
  }

  const addNodeForDiagram = handleAddNode.bind(null, diagramId, projectId);
  const addConnectionForDiagram = handleAddConnection.bind(null, diagramId, projectId);
  const deleteDiagramAction = handleDeleteDiagram.bind(null, diagramId, projectId);
  const addLayerForDiagram = handleAddLayer.bind(null, diagramId, projectId);

  const hiddenLayerIds = new Set((sp?.hidden || "").split(",").filter(Boolean));
  const stepsParam = hasSimRequest ? `steps=${requestedSteps}` : "";
  function toggleHiddenHref(layerId) {
    const next = new Set(hiddenLayerIds);
    if (next.has(layerId)) next.delete(layerId);
    else next.add(layerId);
    const hiddenParam = next.size > 0 ? `hidden=${[...next].join(",")}` : "";
    const query = [hiddenParam, stepsParam].filter(Boolean).join("&");
    return backTo(projectId, diagramId, query ? `?${query}` : "");
  }

  const visibleNodes = diagram.nodes.filter((n) => !n.layerId || !hiddenLayerIds.has(n.layerId));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleConnections = diagram.connections.filter(
    (c) => visibleNodeIds.has(c.fromNodeId) && visibleNodeIds.has(c.toNodeId)
  );

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <Link href={`/projects/${projectId}/economy`} className="text-faint" style={{ fontSize: "0.85rem" }}>&larr; All diagrams</Link>
          <h1 style={{ marginTop: 8 }}>{diagram.name}</h1>
          {diagram.description && <p className="text-muted">{diagram.description}</p>}
        </div>
        <form action={deleteDiagramAction}>
          <button type="submit" className="btn btn-danger btn-sm">Delete diagram</button>
        </form>
      </div>

      {errorMessage && <div className="notice notice-error">{errorMessage}</div>}

      <div className="section-head" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.2rem" }}>Diagram</h2>
        <DiagramExportButtons jsonExportUrl={`/api/economy/${diagramId}/export`} diagramName={diagram.name} />
      </div>
      <div style={{ marginBottom: 32 }}>
        <EconomyDiagramView nodes={visibleNodes} connections={visibleConnections} />
      </div>

      <div className="section-head" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Layers</h2>
        <p className="text-muted" style={{ fontSize: "0.88rem" }}>Group nodes into layers (e.g. Core Loop, Monetization) and toggle their visibility in the diagram above.</p>
      </div>
      <div className="grid grid-2" style={{ alignItems: "start", marginBottom: 32 }}>
        <div>
          {diagram.layers.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 16 }}>No layers yet.</div>
          ) : (
            <div className="table-card" style={{ marginBottom: 16 }}>
              {diagram.layers.map((layer) => {
                const updateForLayer = handleUpdateLayer.bind(null, layer.id, diagramId, projectId);
                const deleteForLayer = handleDeleteLayer.bind(null, layer.id, diagramId, projectId);
                const isHidden = hiddenLayerIds.has(layer.id);
                return (
                  <div key={layer.id} className="economy-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="diagram-legend-dot" style={{ background: layer.color, width: 12, height: 12 }} />
                        <strong>{layer.name}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Link href={toggleHiddenHref(layer.id)} className="btn btn-secondary btn-sm">
                          {isHidden ? "Show" : "Hide"}
                        </Link>
                        <form action={deleteForLayer}>
                          <button type="submit" className="btn btn-danger btn-sm">Delete</button>
                        </form>
                      </div>
                    </div>
                    <form action={updateForLayer} className="inline-form">
                      <div className="field">
                        <label>Name</label>
                        <input type="text" name="name" defaultValue={layer.name} style={{ width: 140 }} required />
                      </div>
                      <div className="field">
                        <label>Color</label>
                        <input type="color" name="color" defaultValue={layer.color} style={{ width: 60, padding: 2 }} />
                      </div>
                      <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ maxWidth: 380 }}>
          <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Add layer</h3>
          <form action={addLayerForDiagram}>
            <div className="field">
              <label htmlFor="layerName">Name</label>
              <input type="text" id="layerName" name="name" placeholder="e.g. Core Loop" required />
            </div>
            <div className="field">
              <label htmlFor="layerColor">Color</label>
              <input type="color" id="layerColor" name="color" defaultValue="#6366f1" style={{ width: 60, padding: 2 }} />
            </div>
            <button type="submit" className="btn btn-primary btn-block">Add layer</button>
          </form>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start", marginBottom: 32 }}>
        <div>
          <h3 style={{ marginBottom: 12 }}>Nodes</h3>
          {diagram.nodes.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 16 }}>No nodes yet.</div>
          ) : (
            <div className="table-card" style={{ marginBottom: 16 }}>
              {diagram.nodes.map((node) => {
                const updateForNode = handleUpdateNode.bind(null, node.id, diagramId, projectId);
                const deleteForNode = handleDeleteNode.bind(null, node.id, diagramId, projectId);
                return (
                  <div key={node.id} className="economy-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{node.name}</strong>{" "}
                        <span className="node-type-badge" style={{ background: `${ECONOMY_TYPE_COLOR[node.type]}22`, color: ECONOMY_TYPE_COLOR[node.type] }}>
                          {node.type}
                        </span>
                        <div className="text-faint" style={{ fontSize: "0.78rem", marginTop: 2 }}>{node.resourceName}</div>
                        {node.layer && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <span className="diagram-legend-dot" style={{ background: node.layer.color }} />
                            <span className="text-faint" style={{ fontSize: "0.75rem" }}>{node.layer.name}</span>
                          </div>
                        )}
                      </div>
                      <form action={deleteForNode}>
                        <button type="submit" className="btn btn-danger btn-sm">Delete</button>
                      </form>
                    </div>
                    <form action={updateForNode} className="inline-form">
                      <div className="field">
                        <label>Initial</label>
                        <input type="number" name="initialValue" step="any" min="0" defaultValue={node.initialValue} style={{ width: 90 }} />
                      </div>
                      <div className="field">
                        <label>Capacity</label>
                        <input type="number" name="capacity" step="any" min="0" defaultValue={node.capacity ?? ""} placeholder="∞" style={{ width: 90 }} />
                      </div>
                      <div className="field">
                        <label>Layer</label>
                        <select name="layerId" defaultValue={node.layerId || ""} style={{ width: 130 }}>
                          <option value="">No layer</option>
                          {diagram.layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Add node</h3>
            <form action={addNodeForDiagram}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input type="text" id="name" name="name" placeholder="e.g. Player Wallet" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="type">Type</label>
                  <select id="type" name="type" defaultValue="POOL">
                    {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="resourceName">Resource</label>
                  <input type="text" id="resourceName" name="resourceName" placeholder="e.g. Gold" required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="initialValue">Initial value</label>
                  <input type="number" id="initialValue" name="initialValue" step="any" min="0" defaultValue="0" />
                </div>
                <div className="field">
                  <label htmlFor="capacity">Capacity</label>
                  <input type="number" id="capacity" name="capacity" step="any" min="0" placeholder="Unlimited" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="layerId">Layer</label>
                <select id="layerId" name="layerId" defaultValue="">
                  <option value="">No layer</option>
                  {diagram.layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-block">Add node</button>
            </form>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 12 }}>Connections</h3>
          {diagram.connections.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 16 }}>No connections yet.</div>
          ) : (
            <div className="table-card" style={{ marginBottom: 16 }}>
              {diagram.connections.map((conn) => {
                const fromNode = diagram.nodes.find((n) => n.id === conn.fromNodeId);
                const toNode = diagram.nodes.find((n) => n.id === conn.toNodeId);
                const updateForConn = handleUpdateConnection.bind(null, conn.id, diagramId, projectId);
                const deleteForConn = handleDeleteConnection.bind(null, conn.id, diagramId, projectId);
                return (
                  <div key={conn.id} className="economy-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.88rem" }}>{fromNode?.name || "?"} &rarr; {toNode?.name || "?"}</strong>
                      <form action={deleteForConn}>
                        <button type="submit" className="btn btn-danger btn-sm">Delete</button>
                      </form>
                    </div>
                    <form action={updateForConn} className="inline-form">
                      <div className="field">
                        <label>Rate</label>
                        <input type="number" name="rate" step="any" min="0" defaultValue={conn.rate} style={{ width: 90 }} />
                      </div>
                      <div className="field">
                        <label>± Variance</label>
                        <input type="number" name="rateVariance" step="any" min="0" defaultValue={conn.rateVariance} style={{ width: 90 }} />
                      </div>
                      <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Add connection</h3>
            {diagram.nodes.length < 2 ? (
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>Add at least two nodes first.</p>
            ) : (
              <form action={addConnectionForDiagram}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="fromNodeId">From</label>
                    <select id="fromNodeId" name="fromNodeId" defaultValue="" required>
                      <option value="" disabled>Select a node</option>
                      {diagram.nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="toNodeId">To</label>
                    <select id="toNodeId" name="toNodeId" defaultValue="" required>
                      <option value="" disabled>Select a node</option>
                      {diagram.nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.type})</option>)}
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="rate">Rate per step</label>
                    <input type="number" id="rate" name="rate" step="any" min="0" defaultValue="1" required />
                  </div>
                  <div className="field">
                    <label htmlFor="rateVariance">± Variance</label>
                    <input type="number" id="rateVariance" name="rateVariance" step="any" min="0" defaultValue="0" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block">Add connection</button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Simulate</h2>
        <p className="text-muted" style={{ fontSize: "0.88rem" }}>Run the diagram forward and see how each pool, converter, and drain evolves.</p>
      </div>
      <form method="GET" className="inline-form" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="steps">Steps</label>
          <input type="number" id="steps" name="steps" min="1" max="500" defaultValue={hasSimRequest ? requestedSteps : 20} style={{ width: 100 }} />
        </div>
        <button type="submit" className="btn btn-primary">Run simulation</button>
      </form>

      {simError && <div className="notice notice-error">{simError}</div>}

      {simResult && (
        <div className="card">
          <SimulationChart nodes={diagram.nodes} series={simResult.series} steps={simResult.steps} />

          <div className="table-card" style={{ marginTop: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>Final</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {diagram.nodes.map((node) => {
                  const values = simResult.series[node.id] || [];
                  const start = values[0];
                  const final = values[values.length - 1];
                  const trend = simResult.balance.trends.find((t) => t.nodeId === node.id);
                  return (
                    <tr key={node.id}>
                      <td>{node.name}</td>
                      <td className="text-faint">{node.type}</td>
                      <td>{start === null ? "—" : start.toLocaleString()}</td>
                      <td>{final === null ? "—" : final.toLocaleString()}</td>
                      <td className="text-faint">{trend ? trend.direction : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <BalanceReport nodes={diagram.nodes} balance={simResult.balance} />
          </div>
        </div>
      )}
    </div>
  );
}
