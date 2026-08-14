const TYPE_COLUMN = { SOURCE: 0, POOL: 1, CONVERTER: 1, DRAIN: 2 };
const TYPE_COLOR = {
  SOURCE: "#3fbf82",
  POOL: "#6366f1",
  CONVERTER: "#f0a63a",
  DRAIN: "#e5484d",
};

const NODE_W = 150;
const NODE_H = 56;
const COL_GAP = 220;
const ROW_GAP = 84;
const PAD = 40;

function layout(nodes) {
  const columns = { 0: [], 1: [], 2: [] };
  for (const node of nodes) {
    columns[TYPE_COLUMN[node.type]].push(node);
  }
  const positions = new Map();
  for (const col of [0, 1, 2]) {
    columns[col].forEach((node, i) => {
      positions.set(node.id, {
        x: PAD + col * COL_GAP,
        y: PAD + i * ROW_GAP,
      });
    });
  }
  return positions;
}

export default function EconomyDiagramView({ nodes, connections }) {
  if (nodes.length === 0) {
    return <div className="empty-state">Add nodes to see the diagram.</div>;
  }

  const positions = layout(nodes);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const maxRows = Math.max(1, ...[0, 1, 2].map((col) => nodes.filter((n) => TYPE_COLUMN[n.type] === col).length));
  const width = PAD * 2 + 2 * COL_GAP + NODE_W;
  const height = PAD * 2 + Math.max(1, maxRows - 1) * ROW_GAP + NODE_H;

  return (
    <div className="diagram-scroll">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Economy diagram">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#6b7285" />
          </marker>
        </defs>

        {connections.map((conn) => {
          const from = positions.get(conn.fromNodeId);
          const to = positions.get(conn.toNodeId);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const label = conn.rateVariance > 0 ? `${conn.rate}±${conn.rateVariance}` : `${conn.rate}`;
          return (
            <g key={conn.id}>
              <path
                d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                fill="none"
                stroke="#6b7285"
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
              />
              <rect x={midX - 20} y={midY - 10} width="40" height="18" rx="4" fill="#0b0d12" />
              <text x={midX} y={midY + 3} textAnchor="middle" fontSize="10" fill="#a2a8ba">{label}</text>
            </g>
          );
        })}

        {nodes.map((node) => {
          const pos = positions.get(node.id);
          const color = TYPE_COLOR[node.type];
          return (
            <g key={node.id}>
              <rect
                x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx="10"
                fill="#12151c" stroke={color} strokeWidth="1.5"
              />
              {node.layer && (
                <rect x={pos.x} y={pos.y} width="5" height={NODE_H} rx="3" fill={node.layer.color} />
              )}
              <text x={pos.x + 16} y={pos.y + 22} fontSize="12" fontWeight="700" fill="#eef0f5">
                {node.name.length > 15 ? `${node.name.slice(0, 14)}…` : node.name}
              </text>
              <text x={pos.x + 16} y={pos.y + 40} fontSize="10" fill={color}>
                {node.type} · {node.resourceName}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="diagram-legend">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="diagram-legend-item">
            <span className="diagram-legend-dot" style={{ background: color }} />
            {type}
          </span>
        ))}
        {[...new Map(nodes.filter((n) => n.layer).map((n) => [n.layer.id, n.layer])).values()].map((layer) => (
          <span key={layer.id} className="diagram-legend-item">
            <span className="diagram-legend-dot" style={{ background: layer.color }} />
            {layer.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Referenced by other components for consistent node coloring in the "nodes" listing.
export { TYPE_COLOR as ECONOMY_TYPE_COLOR };
