import { describe, it, expect } from "vitest";
import { buildAnalysisResultFromScan } from "./reconstructAnalysisResult";
import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem } from "./firebase/actionItems";

const baseScan: AnalysisRecord = {
  id: "scan-1",
  url: "https://a.com/",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 65,
  createdAt: "2026-06-01T00:00:00.000Z",
  categoryScores: { navigation: 70 },
};

const richItem: ActionItem = {
  id: "item-1",
  userId: "uid-1",
  url: "https://a.com/",
  analysisType: "homepage",
  category: "ux-clarity",
  severity: "high",
  title: "Weak headline",
  description: "The hero headline is vague",
  fix: "Lead with the core benefit",
  impactScore: 90,
  status: "open",
  createdAt: "2026-06-01T00:05:00.000Z",
  selector: "header > h1",
  roiEstimate: "+3% conversion",
  insightCluster: "Clarity Gap",
  screenshotUrl: "https://cdn.example.com/shot.png",
  sourceCitation: "NNGroup heuristic #4",
  benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" },
  abTest: {
    testName: "Headline Clarity Test",
    hypothesis: "A clearer headline increases signups",
    control: "Current headline",
    variant: "Benefit-led headline",
    metric: "Signup rate",
    duration: "2 weeks",
  },
};

const bareItem: ActionItem = {
  id: "item-2",
  userId: "uid-1",
  url: "https://a.com/",
  analysisType: "homepage",
  category: "technical-seo",
  severity: "med",
  title: "Missing canonical",
  description: "No canonical tag found",
  fix: "Add a canonical link tag",
  impactScore: 60,
  status: "open",
  createdAt: "2026-06-01T00:06:00.000Z",
};

describe("buildAnalysisResultFromScan", () => {
  it("carries over the scan's basic metadata", () => {
    const result = buildAnalysisResultFromScan(baseScan, [], {});
    expect(result.url).toBe("https://a.com/");
    expect(result.timestamp).toBe("2026-06-01T00:00:00.000Z");
    expect(result.device).toBe("desktop");
    expect(result.analysisType).toBe("homepage");
    expect(result.conversionScore).toBe(65);
  });

  it("maps a friction point that has full persisted evidence", () => {
    const result = buildAnalysisResultFromScan(baseScan, [richItem], {});
    const point = result.frictionPoints[0];
    expect(point.selector).toBe("header > h1");
    expect(point.roiEstimate).toBe("+3% conversion");
    expect(point.insightCluster).toBe("Clarity Gap");
    expect(point.screenshotUrl).toBe("https://cdn.example.com/shot.png");
    expect(point.sourceCitation).toBe("NNGroup heuristic #4");
    expect(point.benchmark).toEqual({ industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" });
    expect(point.abTest.testName).toBe("Headline Clarity Test");
  });

  it("falls back to safe defaults for a friction point lacking evidence (older record or technical issue)", () => {
    const result = buildAnalysisResultFromScan(baseScan, [bareItem], {});
    const point = result.frictionPoints[0];
    expect(point.selector).toBe("");
    expect(point.benchmark).toEqual({ industryAvg: 50, topPerformers: 80, label: "" });
    expect(point.abTest).toEqual({ testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" });
  });

  it("builds per-category benchmark scores from the static category benchmarks", () => {
    const result = buildAnalysisResultFromScan(baseScan, [], {});
    expect(result.benchmark.categoryScores.navigation).toEqual({ score: 70, industryAvg: 58 });
  });

  it("prefers live benchmarks over static ones when there are enough samples", () => {
    const result = buildAnalysisResultFromScan(baseScan, [], {
      navigation: { accountAvg: 66, topQuartile: 90, sampleCount: 10 },
    });
    expect(result.benchmark.categoryScores.navigation?.industryAvg).toBe(66);
  });

  it("computes an overall industryAvg/topQuartile from the category benchmarks", () => {
    const result = buildAnalysisResultFromScan(baseScan, [], {});
    expect(result.benchmark.industryAvg).toBe(58);
    expect(result.benchmark.topQuartile).toBe(82);
  });

  it("uses a reasonable default overall benchmark when there are no category scores", () => {
    const result = buildAnalysisResultFromScan({ ...baseScan, categoryScores: {} }, [], {});
    expect(result.benchmark.industryAvg).toBeGreaterThan(0);
    expect(result.benchmark.topQuartile).toBeGreaterThan(result.benchmark.industryAvg);
  });
});
