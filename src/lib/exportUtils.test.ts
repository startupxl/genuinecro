import { describe, it, expect } from "vitest";
import { copyAsJiraTickets } from "./exportUtils";
import type { AnalysisResult, FrictionPoint } from "./mockData";

const baseResult: AnalysisResult = {
  url: "https://a.com/",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop",
  analysisType: "homepage",
  conversionScore: 65,
  frictionPoints: [],
  benchmark: { overallScore: 65, industryAvg: 55, topQuartile: 80, categoryScores: {} },
};

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Weak headline",
    description: "d",
    selector: ".hero",
    fix: "f",
    impactScore: 80,
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("copyAsJiraTickets", () => {
  it("includes a Duration line for the A/B test recommendation", () => {
    const text = copyAsJiraTickets(baseResult, [buildPoint()]);
    expect(text).toContain("*Duration:* 2 weeks");
  });

  it("includes a Why this duration line when durationRationale is present", () => {
    const point = buildPoint({
      abTest: {
        testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks",
        durationRationale: "Assumes ~1,000 weekly visitors and the baseline conversion rate.",
      },
    });
    const text = copyAsJiraTickets(baseResult, [point]);
    expect(text).toContain("*Why this duration:* Assumes ~1,000 weekly visitors and the baseline conversion rate.");
  });

  it("omits the Why this duration line when durationRationale is absent", () => {
    const text = copyAsJiraTickets(baseResult, [buildPoint()]);
    expect(text).not.toContain("Why this duration");
  });
});
