const RESOURCE_DIRECTION_COLOR = { growing: "#3fbf82", shrinking: "#e5484d", stable: "#6b7285", idle: "#6b7285" };
const SEVERITY_LABEL = { severe: "Severe", moderate: "Moderate", minor: "Minor" };
const SEVERITY_COLOR = { severe: "#e5484d", moderate: "#f0a63a", minor: "#6b7285" };
const CAUSE_EXPLANATION = {
  starved: "the source can't supply it fast enough",
  capped: "the destination doesn't have room to receive it",
  mixed: "supply and capacity are both limiting it",
};

export default function BalanceReport({ nodes, balance }) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const nodeName = (id) => nodesById.get(id)?.name || "?";

  const hasIssues = balance.bottlenecks.length > 0 || balance.saturatedNodes.length > 0 || balance.starvedNodes.length > 0;

  return (
    <div>
      <h3 style={{ marginBottom: 4, fontSize: "0.95rem" }}>Resource flow</h3>
      <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: 12 }}>
        What each resource&apos;s Source nodes emitted vs. what its Drain nodes absorbed over the run.
      </p>
      {balance.resources.length === 0 ? (
        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 24 }}>No Source or Drain nodes to measure flow.</p>
      ) : (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Emitted</th>
                <th>Absorbed</th>
                <th>Net</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {balance.resources.map((r) => (
                <tr key={r.resourceName}>
                  <td>{r.resourceName}</td>
                  <td>{r.emitted.toLocaleString()}</td>
                  <td>{r.absorbed.toLocaleString()}</td>
                  <td>{r.net > 0 ? "+" : ""}{r.net.toLocaleString()}</td>
                  <td><span style={{ color: RESOURCE_DIRECTION_COLOR[r.direction] }}>{r.direction}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: 8, fontSize: "0.95rem" }}>Balance issues</h3>
      {!hasIssues ? (
        <p className="text-muted" style={{ fontSize: "0.85rem" }}>No bottlenecks, saturation, or starvation detected over this run.</p>
      ) : (
        <ul style={{ fontSize: "0.85rem", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
          {balance.bottlenecks.map((b) => (
            <li key={b.connectionId}>
              <strong>Bottleneck</strong>{" "}
              <span style={{ color: SEVERITY_COLOR[b.severity] }}>({SEVERITY_LABEL[b.severity]})</span>:{" "}
              {nodeName(b.fromNodeId)} &rarr; {nodeName(b.toNodeId)} only delivered{" "}
              {Math.round((1 - b.shortfallRatio) * 100)}% of requested flow ({Math.round(b.transferred).toLocaleString()} of{" "}
              {Math.round(b.requested).toLocaleString()}) — {CAUSE_EXPLANATION[b.cause]}.
            </li>
          ))}
          {balance.saturatedNodes.map((s) => (
            <li key={`sat-${s.nodeId}`}>
              <strong>Saturated:</strong> {nodeName(s.nodeId)} sat at capacity for {Math.round(s.ratio * 100)}% of the run —
              inflow beyond that point is being wasted.
            </li>
          ))}
          {balance.starvedNodes.map((s) => (
            <li key={`starve-${s.nodeId}`}>
              <strong>Starved:</strong> {nodeName(s.nodeId)} was empty for {Math.round(s.ratio * 100)}% of the run —
              downstream demand on it is going unmet.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
