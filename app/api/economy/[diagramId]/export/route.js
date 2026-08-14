import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDiagramForWorkspace } from "@/lib/economy";

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram"
  );
}

export async function GET(request, { params }) {
  const { diagramId } = await params;
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const diagram = await getDiagramForWorkspace(diagramId, session.user.workspaceId);
  if (!diagram) return new NextResponse("Not found", { status: 404 });

  const exportData = {
    name: diagram.name,
    description: diagram.description,
    exportedAt: new Date().toISOString(),
    layers: diagram.layers.map((l) => ({ id: l.id, name: l.name, color: l.color, order: l.order })),
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      resourceName: n.resourceName,
      initialValue: n.initialValue,
      capacity: n.capacity,
      layerId: n.layerId,
    })),
    connections: diagram.connections.map((c) => ({
      id: c.id,
      fromNodeId: c.fromNodeId,
      toNodeId: c.toNodeId,
      rate: c.rate,
      rateVariance: c.rateVariance,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${slugify(diagram.name)}.json"`,
    },
  });
}
