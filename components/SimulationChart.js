const LINE_COLORS = ["#6366f1", "#f0a63a", "#3fbf82", "#e5484d", "#a855f7", "#22d3ee", "#f472b6", "#84cc16"];

const CHART_W = 640;
const CHART_H = 280;
const PAD_LEFT = 56;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

export default function SimulationChart({ nodes, series, steps }) {
  const plottable = nodes.filter((n) => n.type !== "SOURCE");
  if (plottable.length === 0) {
    return <p className="text-muted">No pools, converters, or drains to chart — a diagram with only a Source has nothing to plot.</p>;
  }

  const allValues = plottable.flatMap((n) => (series[n.id] || []).filter((v) => v !== null));
  const maxValue = Math.max(1, ...allValues);

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const xFor = (stepIndex) => PAD_LEFT + (stepIndex / steps) * plotW;
  const yFor = (value) => PAD_TOP + plotH - (value / maxValue) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD_TOP + plotH - f * plotH,
    label: Math.round(maxValue * f).toLocaleString(),
  }));

  return (
    <div className="diagram-scroll">
      <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Simulation results chart">
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD_LEFT} y1={g.y} x2={CHART_W - PAD_RIGHT} y2={g.y} stroke="#262b38" strokeWidth="1" />
            <text x={PAD_LEFT - 8} y={g.y + 3} textAnchor="end" fontSize="10" fill="#6b7285">{g.label}</text>
          </g>
        ))}
        <text x={PAD_LEFT} y={CHART_H - 8} fontSize="10" fill="#6b7285">step 0</text>
        <text x={CHART_W - PAD_RIGHT} y={CHART_H - 8} textAnchor="end" fontSize="10" fill="#6b7285">step {steps}</text>

        {plottable.map((node, i) => {
          const values = series[node.id] || [];
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const points = values.map((v, stepIndex) => `${xFor(stepIndex)},${yFor(v ?? 0)}`).join(" ");
          return <polyline key={node.id} points={points} fill="none" stroke={color} strokeWidth="2" />;
        })}
      </svg>
      <div className="diagram-legend">
        {plottable.map((node, i) => (
          <span key={node.id} className="diagram-legend-item">
            <span className="diagram-legend-dot" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
            {node.name}
          </span>
        ))}
      </div>
    </div>
  );
}
