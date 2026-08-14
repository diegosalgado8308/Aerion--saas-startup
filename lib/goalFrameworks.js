/**
 * The 8 project goal-planning frameworks a project can optionally adopt.
 * Stage breakdowns are this app's own interpretation, not a claim that
 * these are externally standardized methodologies (PACT is the one
 * exception with real external provenance, and even that's been
 * customized here per product decision — see the "problem/approach/
 * compromise/test" stages below, not the original "purposeful/
 * actionable/continuous/trackable").
 */
export const GOAL_FRAMEWORKS = {
  PACT: {
    label: "PACT",
    stages: [
      { key: "problem", label: "Problem" },
      { key: "approach", label: "Approach" },
      { key: "compromise", label: "Compromise" },
      { key: "test", label: "Test" },
    ],
  },
  RTF: {
    label: "RTF",
    stages: [
      { key: "result", label: "Result" },
      { key: "timeline", label: "Timeline" },
      { key: "focus", label: "Focus" },
    ],
  },
  SOLVE: {
    label: "SOLVE",
    stages: [
      { key: "situation", label: "Situation" },
      { key: "objective", label: "Objective" },
      { key: "list", label: "List options" },
      { key: "vote", label: "Vote / decide" },
      { key: "execute", label: "Execute" },
    ],
  },
  TAG: {
    label: "TAG",
    stages: [
      { key: "target", label: "Target" },
      { key: "action", label: "Action" },
      { key: "gauge", label: "Gauge" },
    ],
  },
  RACE: {
    label: "RACE",
    stages: [
      { key: "result", label: "Result" },
      { key: "action", label: "Action" },
      { key: "checkin", label: "Check-in" },
      { key: "evaluate", label: "Evaluate" },
    ],
  },
  DREAM: {
    label: "DREAM",
    stages: [
      { key: "define", label: "Define" },
      { key: "research", label: "Research" },
      { key: "execute", label: "Execute" },
      { key: "assess", label: "Assess" },
      { key: "modify", label: "Modify" },
    ],
  },
  CARE: {
    label: "CARE",
    stages: [
      { key: "context", label: "Context" },
      { key: "action", label: "Action" },
      { key: "result", label: "Result" },
      { key: "evaluate", label: "Evaluate" },
    ],
  },
  RISE: {
    label: "RISE",
    stages: [
      { key: "reflect", label: "Reflect" },
      { key: "identify", label: "Identify" },
      { key: "set", label: "Set" },
      { key: "execute", label: "Execute" },
    ],
  },
};

export const GOAL_FRAMEWORK_KEYS = Object.keys(GOAL_FRAMEWORKS);

export function isValidFrameworkKey(key) {
  return Object.prototype.hasOwnProperty.call(GOAL_FRAMEWORKS, key);
}

export function isValidStageKey(frameworkKey, stageKey) {
  const framework = GOAL_FRAMEWORKS[frameworkKey];
  return Boolean(framework?.stages.some((stage) => stage.key === stageKey));
}
