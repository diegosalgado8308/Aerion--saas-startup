import { describe, it, expect } from "vitest";
import { runSimulation, analyzeBalance } from "@/lib/economy-simulation";

function node(id, type, overrides = {}) {
  return { id, type, initialValue: 0, capacity: null, ...overrides };
}

function conn(id, fromNodeId, toNodeId, rate, rateVariance = 0) {
  return { id, fromNodeId, toNodeId, rate, rateVariance };
}

describe("runSimulation validation", () => {
  it("rejects a non-positive step count", () => {
    expect(() => runSimulation({ nodes: [], connections: [], steps: 0 })).toThrow();
    expect(() => runSimulation({ nodes: [], connections: [], steps: -3 })).toThrow();
    expect(() => runSimulation({ nodes: [], connections: [], steps: 1.5 })).toThrow();
  });
});

describe("Source -> Pool", () => {
  it("accumulates rate * steps in the pool with no cap", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL", { initialValue: 0 })];
    const connections = [conn("c1", "src", "pool", 10)];

    const result = runSimulation({ nodes, connections, steps: 5 });

    expect(result.series.src).toEqual([null, null, null, null, null, null]);
    expect(result.series.pool).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("stops accumulating once the pool hits capacity", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL", { initialValue: 0, capacity: 25 })];
    const connections = [conn("c1", "src", "pool", 10)];

    const result = runSimulation({ nodes, connections, steps: 5 });

    expect(result.series.pool).toEqual([0, 10, 20, 25, 25, 25]);
  });
});

describe("Pool -> Drain", () => {
  it("drains a finite pool and clamps at zero rather than going negative", () => {
    const nodes = [node("pool", "POOL", { initialValue: 15 }), node("drain", "DRAIN")];
    const connections = [conn("c1", "pool", "drain", 10)];

    const result = runSimulation({ nodes, connections, steps: 3 });

    // step1: 15->5 (drain +10), step2: 5->0 (drain +5, capped by availability), step3: stays 0
    expect(result.series.pool).toEqual([15, 5, 0, 0]);
    expect(result.series.drain).toEqual([0, 10, 15, 15]);
  });
});

describe("Converter behaves as an intermediate buffer", () => {
  it("passes resource through in the same step when ordered source-first", () => {
    const nodes = [node("src", "SOURCE"), node("conv", "CONVERTER", { initialValue: 0 }), node("drain", "DRAIN")];
    // "a" sorts before "b" alphabetically, matching Source->Converter then Converter->Drain
    const connections = [conn("a-src-conv", "src", "conv", 10), conn("b-conv-drain", "conv", "drain", 10)];

    const result = runSimulation({ nodes, connections, steps: 1 });

    expect(result.series.conv).toEqual([0, 0]); // arrived and left within the same step
    expect(result.series.drain).toEqual([0, 10]);
  });

  it("takes an extra step to pass through when ordered drain-first", () => {
    const nodes = [node("src", "SOURCE"), node("conv", "CONVERTER", { initialValue: 0 }), node("drain", "DRAIN")];
    // "a" sorts before "b" — put Converter->Drain first this time
    const connections = [conn("a-conv-drain", "conv", "drain", 10), conn("b-src-conv", "src", "conv", 10)];

    const result = runSimulation({ nodes, connections, steps: 2 });

    // step1: conv->drain moves nothing (conv empty yet), then src->conv fills it to 10
    // step2: conv->drain moves the 10 that arrived last step, then src->conv refills to 10
    expect(result.series.conv).toEqual([0, 10, 10]);
    expect(result.series.drain).toEqual([0, 0, 10]);
  });
});

describe("Multiple connections sharing a source pool", () => {
  it("only distributes what's actually available, in connection order", () => {
    const nodes = [
      node("pool", "POOL", { initialValue: 8 }),
      node("drainA", "DRAIN"),
      node("drainB", "DRAIN"),
    ];
    // Both want 5, but only 8 is available: A (sorts first) gets 5, B gets the remaining 3.
    const connections = [conn("a", "pool", "drainA", 5), conn("b", "pool", "drainB", 5)];

    const result = runSimulation({ nodes, connections, steps: 1 });

    expect(result.series.pool).toEqual([8, 0]);
    expect(result.series.drainA).toEqual([0, 5]);
    expect(result.series.drainB).toEqual([0, 3]);
  });
});

describe("rate variance", () => {
  it("is deterministic given a fixed random function", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL")];
    const connections = [conn("c1", "src", "pool", 10, 4)];

    // random() always returns 1 -> variance = (1*2-1)*4 = +4 -> requested = 14
    const result = runSimulation({ nodes, connections, steps: 2, random: () => 1 });
    expect(result.series.pool).toEqual([0, 14, 28]);
  });

  it("never produces negative flow even with large negative variance", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL")];
    const connections = [conn("c1", "src", "pool", 5, 100)];

    // random() always returns 0 -> variance = (0*2-1)*100 = -100 -> requested = max(0, 5-100) = 0
    const result = runSimulation({ nodes, connections, steps: 1, random: () => 0 });
    expect(result.series.pool).toEqual([0, 0]);
  });
});

describe("dangling connections", () => {
  it("ignores a connection whose node was not provided", () => {
    const nodes = [node("pool", "POOL", { initialValue: 5 })];
    const connections = [conn("c1", "pool", "ghost-node", 10)];

    const result = runSimulation({ nodes, connections, steps: 2 });
    expect(result.series.pool).toEqual([5, 5, 5]);
  });
});

function simulateAndAnalyze({ nodes, connections, steps, random }) {
  const result = runSimulation({ nodes, connections, steps, random });
  return analyzeBalance({ nodes, connections, ...result });
}

describe("analyzeBalance bottlenecks", () => {
  it("flags a connection that couldn't get most of what it requested", () => {
    const nodes = [node("pool", "POOL", { initialValue: 8 }), node("drainA", "DRAIN"), node("drainB", "DRAIN")];
    // Same setup as the "shares a source pool" runSimulation test: A gets all 5, B only gets 3 of 5.
    const connections = [conn("a", "pool", "drainA", 5), conn("b", "pool", "drainB", 5)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 1 });

    expect(balance.bottlenecks).toHaveLength(1);
    expect(balance.bottlenecks[0]).toMatchObject({ connectionId: "b", requested: 5, transferred: 3 });
  });

  it("does not flag a connection with no requested flow", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL")];
    const connections = [conn("c1", "src", "pool", 0)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 3 });

    expect(balance.bottlenecks).toEqual([]);
  });
});

describe("analyzeBalance saturation and starvation", () => {
  it("flags a pool that spends most of the run pinned at capacity", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL", { initialValue: 0, capacity: 25 })];
    const connections = [conn("c1", "src", "pool", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 5 });

    expect(balance.saturatedNodes).toEqual([{ nodeId: "pool", ratio: 0.6 }]);
    expect(balance.starvedNodes).toEqual([]);
  });

  it("flags a pool that spends most of the run empty", () => {
    const nodes = [node("pool", "POOL", { initialValue: 15 }), node("drain", "DRAIN")];
    const connections = [conn("c1", "pool", "drain", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 3 });

    expect(balance.starvedNodes).toEqual([{ nodeId: "pool", ratio: 2 / 3 }]);
    expect(balance.saturatedNodes).toEqual([]);
  });

  it("ignores Source and Drain nodes for saturation/starvation, even though Drain never stops at zero", () => {
    const nodes = [node("src", "SOURCE"), node("drain", "DRAIN")];
    const connections = [conn("c1", "src", "drain", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 3 });

    expect(balance.saturatedNodes).toEqual([]);
    expect(balance.starvedNodes).toEqual([]);
  });
});

describe("analyzeBalance resource flow", () => {
  it("nets emitted vs. absorbed for a resource with matching Source and Drain", () => {
    const nodes = [node("src", "SOURCE", { resourceName: "Gold" }), node("drain", "DRAIN", { resourceName: "Gold" })];
    const connections = [conn("c1", "src", "drain", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 3 });

    expect(balance.resources).toEqual([{ resourceName: "Gold", emitted: 30, absorbed: 30, net: 0, direction: "stable" }]);
  });

  it("reports growing when a resource only has a Source and nothing draining it", () => {
    const nodes = [node("src", "SOURCE", { resourceName: "Gold" }), node("pool", "POOL", { resourceName: "Gold" })];
    const connections = [conn("c1", "src", "pool", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 2 });

    expect(balance.resources).toEqual([{ resourceName: "Gold", emitted: 20, absorbed: 0, net: 20, direction: "growing" }]);
  });

  it("reports idle when the resource's Source connection never actually moves anything", () => {
    const nodes = [node("src", "SOURCE", { resourceName: "Gold" }), node("pool", "POOL", { resourceName: "Gold" })];
    const connections = [conn("c1", "src", "pool", 0)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 1 });

    expect(balance.resources).toEqual([{ resourceName: "Gold", emitted: 0, absorbed: 0, net: 0, direction: "idle" }]);
  });
});

describe("analyzeBalance trends", () => {
  it("calls it rising when a pool's second half runs well above its first half", () => {
    const nodes = [node("src", "SOURCE"), node("pool", "POOL", { initialValue: 0 })];
    const connections = [conn("c1", "src", "pool", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 8 });

    expect(balance.trends).toEqual([{ nodeId: "pool", startAvg: 15, endAvg: 75, change: 4, direction: "rising" }]);
  });

  it("calls it falling when a draining pool with no inflow trends down", () => {
    const nodes = [node("pool", "POOL", { initialValue: 100 }), node("drain", "DRAIN")];
    const connections = [conn("c1", "pool", "drain", 10)];

    const balance = simulateAndAnalyze({ nodes, connections, steps: 8 });

    const trend = balance.trends.find((t) => t.nodeId === "pool");
    expect(trend.direction).toBe("falling");
    expect(trend.startAvg).toBeGreaterThan(trend.endAvg);
  });

  it("calls it flat when a pool never moves at all", () => {
    const nodes = [node("pool", "POOL", { initialValue: 50 })];

    const balance = simulateAndAnalyze({ nodes, connections: [], steps: 4 });

    expect(balance.trends).toEqual([{ nodeId: "pool", startAvg: 50, endAvg: 50, change: 0, direction: "flat" }]);
    expect(balance.bottlenecks).toEqual([]);
    expect(balance.saturatedNodes).toEqual([]);
    expect(balance.starvedNodes).toEqual([]);
  });
});
