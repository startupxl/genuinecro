import { describe, it, expect } from "vitest";
import { extractCategoryScores, type BenchmarkSummary } from "./mockData";

describe("extractCategoryScores", () => {
  it("flattens category scores down to plain numbers", () => {
    const benchmark: BenchmarkSummary = {
      overallScore: 62,
      industryAvg: 55,
      topQuartile: 78,
      categoryScores: {
        "content-hierarchy": { score: 65, industryAvg: 55 },
        navigation: { score: 60, industryAvg: 55 },
      },
    };

    expect(extractCategoryScores(benchmark)).toEqual({
      "content-hierarchy": 65,
      navigation: 60,
    });
  });

  it("skips undefined category entries", () => {
    const benchmark: BenchmarkSummary = {
      overallScore: 62,
      industryAvg: 55,
      topQuartile: 78,
      categoryScores: { "content-hierarchy": undefined },
    };

    expect(extractCategoryScores(benchmark)).toEqual({});
  });

  it("returns an empty object when there are no category scores", () => {
    const benchmark: BenchmarkSummary = {
      overallScore: 62,
      industryAvg: 55,
      topQuartile: 78,
      categoryScores: {},
    };

    expect(extractCategoryScores(benchmark)).toEqual({});
  });

  it("returns an empty object rather than throwing when categoryScores itself is missing", () => {
    const benchmark = { overallScore: 62 } as BenchmarkSummary;

    expect(extractCategoryScores(benchmark)).toEqual({});
  });
});
