/**
 * Pure simulation engine for economy diagrams — no DB access, so it's cheap
 * to unit test exhaustively. This is the most correctness-critical part of
 * the feature: everything else is just CRUD around this.
 *
 * Node value semantics:
 * - POOL / CONVERTER: hold a value, clamped to [0, capacity ?? Infinity] each
 *   step. (Converter is mechanically identical to Pool in this simplified
 *   model — the distinction is for the designer's own labeling.)
 * - SOURCE: infinite supply. Its own value is never tracked (always null).
 * - DRAIN: has no capacity limit; its "value" is the cumulative amount
 *   absorbed over the whole simulation, not a depletable store.
 *
 * Each step, every connection attempts to move `rate` (+/- a uniform random
 * amount up to `rateVariance`) from its source node to its destination node,
 * limited by what's actually available at the source and how much room is
 * left at the destination. Connections within a step are processed in a
 * fixed order (sorted by id) so — given a fixed `random` function — a run is
 * fully reproducible. Because of that fixed order, a chain like
 * Source -> Converter -> Drain can move resource through the converter in
 * the *same* step if the Source->Converter connection sorts before the
 * Converter->Drain one; otherwise it takes an extra step to arrive. This is
 * intentional and covered by tests below.
 */
export function runSimulation({ nodes, connections, steps, random = Math.random }) {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("steps must be a positive integer");
  }

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map(nodes.map((n) => [n.id, n.type === "SOURCE" ? null : Math.max(0, n.initialValue || 0)]));
  const series = new Map(nodes.map((n) => [n.id, [state.get(n.id)]]));

  const orderedConnections = [...connections].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Requested vs. actually-transferred totals per connection, summed across the whole run,
  // plus a per-step tally of *why* a step fell short — starvedSteps counts steps where the
  // source didn't have enough, cappedSteps counts steps where the destination didn't have
  // room. Together this is the raw material analyzeBalance() uses to spot bottlenecks and
  // classify their root cause.
  const flow = new Map(orderedConnections.map((c) => [c.id, { requested: 0, transferred: 0, starvedSteps: 0, cappedSteps: 0 }]));

  for (let step = 0; step < steps; step += 1) {
    for (const conn of orderedConnections) {
      const fromNode = nodesById.get(conn.fromNodeId);
      const toNode = nodesById.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const variance = conn.rateVariance ? (random() * 2 - 1) * conn.rateVariance : 0;
      const requested = Math.max(0, conn.rate + variance);

      let available;
      if (fromNode.type === "SOURCE") {
        available = requested;
      } else {
        const current = state.get(fromNode.id) ?? 0;
        available = Math.min(requested, current);
        state.set(fromNode.id, current - available);
      }

      let transferred;
      if (toNode.type === "DRAIN") {
        transferred = available;
        const current = state.get(toNode.id) ?? 0;
        state.set(toNode.id, current + transferred);
      } else {
        const current = state.get(toNode.id) ?? 0;
        const room = toNode.capacity != null ? Math.max(0, toNode.capacity - current) : Infinity;
        transferred = Math.min(available, room);
        state.set(toNode.id, current + transferred);
      }

      const f = flow.get(conn.id);
      f.requested += requested;
      f.transferred += transferred;
      const EPSILON = 1e-9;
      if (requested - available > EPSILON) f.starvedSteps += 1;
      else if (available - transferred > EPSILON) f.cappedSteps += 1;
    }

    for (const node of nodes) {
      series.get(node.id).push(state.get(node.id));
    }
  }

  return {
    steps,
    series: Object.fromEntries(series),
    connectionFlow: Object.fromEntries(flow),
  };
}

const SATURATION_THRESHOLD = 0.5; // fraction of steps at capacity to flag a node as saturated
const STARVATION_THRESHOLD = 0.5; // fraction of steps at zero to flag a node as starved
const BOTTLENECK_THRESHOLD = 0.1; // fraction of requested flow lost to flag a connection as a bottleneck
const BOTTLENECK_SEVERE_THRESHOLD = 0.5; // shortfall ratio at or above this is "severe"
const BOTTLENECK_MODERATE_THRESHOLD = 0.25; // shortfall ratio at or above this (but below severe) is "moderate"
const TREND_THRESHOLD = 0.05; // relative change between the run's first and last quarter to call it a trend

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Diagnoses a completed runSimulation() result for common economy-design
 * problems: connections that can't move as much as they want (bottlenecks —
 * each classified by root cause, "starved" (source-limited) vs. "capped"
 * (destination-limited) vs. "mixed", and by severity, "minor"/"moderate"/
 * "severe" based on shortfall ratio), pools/converters stuck full or empty
 * (saturated/starved), each resource's net flow in vs. out (via its Source
 * and Drain nodes), and whether each pool/converter is trending up, down, or
 * flat over the run. Pure and DB-free like runSimulation, and takes its
 * result directly rather than re-running the sim.
 */
export function analyzeBalance({ nodes, connections, series, connectionFlow }) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const bottlenecks = connections
    .map((conn) => {
      const f = connectionFlow[conn.id];
      if (!f || f.requested <= 0) return null;
      const shortfall = f.requested - f.transferred;
      const shortfallRatio = shortfall / f.requested;
      if (shortfallRatio < BOTTLENECK_THRESHOLD) return null;

      // Root cause: which side of the connection was the limiting factor more
      // often — the source not having enough to give (starved), or the
      // destination not having room to receive it (capped). A tie (including
      // 0/0, e.g. a fully-blocked connection with no capacity check ever
      // reached) is reported as "mixed" rather than arbitrarily picking one.
      const cause = f.starvedSteps > f.cappedSteps ? "starved" : f.cappedSteps > f.starvedSteps ? "capped" : "mixed";
      const severity =
        shortfallRatio >= BOTTLENECK_SEVERE_THRESHOLD
          ? "severe"
          : shortfallRatio >= BOTTLENECK_MODERATE_THRESHOLD
            ? "moderate"
            : "minor";

      return {
        connectionId: conn.id,
        fromNodeId: conn.fromNodeId,
        toNodeId: conn.toNodeId,
        requested: f.requested,
        transferred: f.transferred,
        shortfallRatio,
        cause,
        severity,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.shortfallRatio - a.shortfallRatio);

  const saturatedNodes = [];
  const starvedNodes = [];
  const trends = [];

  for (const node of nodes) {
    if (node.type === "SOURCE" || node.type === "DRAIN") continue;
    const runValues = (series[node.id] || []).slice(1); // drop the initial state, keep only simulated steps
    if (runValues.length === 0) continue;

    if (node.capacity != null) {
      const atCapacityRatio = runValues.filter((v) => v >= node.capacity).length / runValues.length;
      if (atCapacityRatio >= SATURATION_THRESHOLD) {
        saturatedNodes.push({ nodeId: node.id, ratio: atCapacityRatio });
      }
    }

    const atZeroRatio = runValues.filter((v) => v <= 0).length / runValues.length;
    if (atZeroRatio >= STARVATION_THRESHOLD) {
      starvedNodes.push({ nodeId: node.id, ratio: atZeroRatio });
    }

    const quarter = Math.max(1, Math.floor(runValues.length / 4));
    const startAvg = average(runValues.slice(0, quarter));
    const endAvg = average(runValues.slice(-quarter));
    const change = startAvg === 0 ? (endAvg === 0 ? 0 : 1) : (endAvg - startAvg) / startAvg;
    const direction = change > TREND_THRESHOLD ? "rising" : change < -TREND_THRESHOLD ? "falling" : "flat";
    trends.push({ nodeId: node.id, startAvg, endAvg, change, direction });
  }

  const resourceFlow = new Map();
  for (const conn of connections) {
    const f = connectionFlow[conn.id];
    if (!f) continue;
    const fromNode = nodesById.get(conn.fromNodeId);
    const toNode = nodesById.get(conn.toNodeId);
    if (fromNode?.type === "SOURCE") {
      const entry = resourceFlow.get(fromNode.resourceName) || { emitted: 0, absorbed: 0 };
      entry.emitted += f.transferred;
      resourceFlow.set(fromNode.resourceName, entry);
    }
    if (toNode?.type === "DRAIN") {
      const entry = resourceFlow.get(toNode.resourceName) || { emitted: 0, absorbed: 0 };
      entry.absorbed += f.transferred;
      resourceFlow.set(toNode.resourceName, entry);
    }
  }

  const resources = [...resourceFlow.entries()]
    .map(([resourceName, { emitted, absorbed }]) => {
      const net = emitted - absorbed;
      const direction = emitted === 0 && absorbed === 0 ? "idle" : net > 0 ? "growing" : net < 0 ? "shrinking" : "stable";
      return { resourceName, emitted, absorbed, net, direction };
    })
    .sort((a, b) => a.resourceName.localeCompare(b.resourceName));

  return { bottlenecks, saturatedNodes, starvedNodes, trends, resources };
}
