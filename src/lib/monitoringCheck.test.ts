import { describe, it, expect } from "vitest";
import { detectMonitoringAlert, SCORE_DROP_THRESHOLD } from "./monitoringCheck";
import type { FrictionPointInput } from "./firebase/actionItems";

function fp(title: string, severity: "high" | "med" | "low" = "high"): FrictionPointInput {
  return {
    category: "cta-effectiveness",
    severity,
    title,
    description: "d",
    fix: "f",
    impactScore: 80,
  };
}

describe("detectMonitoringAlert", () => {
  it("returns null when the score is unchanged and there are no new critical issues", () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 70,
      previousCriticalTitles: ["Weak call-to-action"],
      newFrictionPoints: [fp("Weak call-to-action")],
    });
    expect(result).toBeNull();
  });

  it("returns null when the score improves", () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 85,
      previousCriticalTitles: [],
      newFrictionPoints: [],
    });
    expect(result).toBeNull();
  });

  it(`returns an alert when the score drops by at least ${SCORE_DROP_THRESHOLD} points`, () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 70 - SCORE_DROP_THRESHOLD,
      previousCriticalTitles: [],
      newFrictionPoints: [],
    });
    expect(result).not.toBeNull();
    expect(result?.scoreDelta).toBe(-SCORE_DROP_THRESHOLD);
    expect(result?.newCriticalIssueTitles).toEqual([]);
  });

  it("does not alert on a drop smaller than the threshold", () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 70 - (SCORE_DROP_THRESHOLD - 1),
      previousCriticalTitles: [],
      newFrictionPoints: [],
    });
    expect(result).toBeNull();
  });

  it("returns an alert when a new high-severity issue appears, even if the score is flat", () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 70,
      previousCriticalTitles: ["Weak call-to-action"],
      newFrictionPoints: [fp("Weak call-to-action"), fp("Slow page load")],
    });
    expect(result).not.toBeNull();
    expect(result?.scoreDelta).toBe(0);
    expect(result?.newCriticalIssueTitles).toEqual(["Slow page load"]);
  });

  it("ignores medium/low severity issues when checking for new critical issues", () => {
    const result = detectMonitoringAlert({
      previousScore: 70,
      newScore: 70,
      previousCriticalTitles: [],
      newFrictionPoints: [fp("Minor copy tweak", "med"), fp("Small spacing issue", "low")],
    });
    expect(result).toBeNull();
  });
});
