import { describe, it, expect } from "vitest";
import { buildCategoryComparison, summarizeGaps } from "./competitorComparison";

describe("buildCategoryComparison", () => {
  it("pairs up matching categories from both sides with a delta", () => {
    const rows = buildCategoryComparison(
      { navigation: { score: 70, industryAvg: 55 }, "trust-credibility": { score: 60, industryAvg: 55 } },
      { navigation: { score: 50, industryAvg: 55 }, "trust-credibility": { score: 80, industryAvg: 55 } }
    );
    const nav = rows.find((r) => r.category === "navigation")!;
    expect(nav).toEqual({ category: "navigation", yourScore: 70, competitorScore: 50, delta: 20 });
    const trust = rows.find((r) => r.category === "trust-credibility")!;
    expect(trust).toEqual({ category: "trust-credibility", yourScore: 60, competitorScore: 80, delta: -20 });
  });

  it("includes a category present only on one side, treating the missing side as 0", () => {
    const rows = buildCategoryComparison({ performance: { score: 65, industryAvg: 55 } }, {});
    expect(rows).toEqual([{ category: "performance", yourScore: 65, competitorScore: 0, delta: 65 }]);
  });

  it("returns an empty array when both sides have no category scores", () => {
    expect(buildCategoryComparison({}, {})).toEqual([]);
  });
});

describe("summarizeGaps", () => {
  const rows = [
    { category: "navigation", yourScore: 70, competitorScore: 50, delta: 20 },
    { category: "trust-credibility", yourScore: 60, competitorScore: 80, delta: -20 },
    { category: "performance", yourScore: 62, competitorScore: 60, delta: 2 },
  ];

  it("buckets categories where you lead by at least the threshold into 'ahead'", () => {
    const { ahead } = summarizeGaps(rows, 5);
    expect(ahead).toEqual([{ category: "navigation", yourScore: 70, competitorScore: 50, delta: 20 }]);
  });

  it("buckets categories where the competitor leads by at least the threshold into 'behind'", () => {
    const { behind } = summarizeGaps(rows, 5);
    expect(behind).toEqual([{ category: "trust-credibility", yourScore: 60, competitorScore: 80, delta: -20 }]);
  });

  it("excludes categories within the threshold from both buckets", () => {
    const { ahead, behind } = summarizeGaps(rows, 5);
    expect(ahead.some((r) => r.category === "performance")).toBe(false);
    expect(behind.some((r) => r.category === "performance")).toBe(false);
  });

  it("sorts 'ahead' by largest lead first and 'behind' by largest deficit first", () => {
    const bigRows = [
      { category: "a", yourScore: 60, competitorScore: 50, delta: 10 },
      { category: "b", yourScore: 90, competitorScore: 50, delta: 40 },
      { category: "c", yourScore: 30, competitorScore: 60, delta: -30 },
      { category: "d", yourScore: 30, competitorScore: 40, delta: -10 },
    ];
    const { ahead, behind } = summarizeGaps(bigRows, 5);
    expect(ahead.map((r) => r.category)).toEqual(["b", "a"]);
    expect(behind.map((r) => r.category)).toEqual(["c", "d"]);
  });
});
