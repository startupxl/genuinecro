import { describe, it, expect } from "vitest";
import { buildAnalysisResultFromScan, buildAnalysisResultFromSite } from "./reconstructAnalysisResult";
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

  it("carries over the scan's conversion goal when present", () => {
    const result = buildAnalysisResultFromScan(
      { ...baseScan, conversionGoal: { type: "lead_form", isMacro: false } }, [], {}
    );
    expect(result.conversionGoal).toEqual({ type: "lead_form", isMacro: false });
  });

  it("leaves conversionGoal undefined for older scans that predate this field", () => {
    const result = buildAnalysisResultFromScan(baseScan, [], {});
    expect(result.conversionGoal).toBeUndefined();
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

  it("carries over effort and confidence when present on the action item", () => {
    const result = buildAnalysisResultFromScan(baseScan, [{ ...richItem, effort: "low", confidence: "high" }], {});
    expect(result.frictionPoints[0].effort).toBe("low");
    expect(result.frictionPoints[0].confidence).toBe("high");
  });

  it("leaves effort and confidence undefined for older action items that predate this field", () => {
    const result = buildAnalysisResultFromScan(baseScan, [bareItem], {});
    expect(result.frictionPoints[0].effort).toBeUndefined();
    expect(result.frictionPoints[0].confidence).toBeUndefined();
  });

  it("carries over userEvidence when present on the action item", () => {
    const result = buildAnalysisResultFromScan(baseScan, [{ ...richItem, userEvidence: "Confirmed with client's analytics team." }], {});
    expect(result.frictionPoints[0].userEvidence).toBe("Confirmed with client's analytics team.");
  });

  it("leaves userEvidence undefined for action items that don't have any yet", () => {
    const result = buildAnalysisResultFromScan(baseScan, [bareItem], {});
    expect(result.frictionPoints[0].userEvidence).toBeUndefined();
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

describe("buildAnalysisResultFromSite", () => {
  const domainRecords: AnalysisRecord[] = [
    { id: "scan-1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z", categoryScores: { navigation: 60 } },
    { id: "scan-2", url: "https://a.com/pricing", analysisType: "landing-marketing", device: "mobile", conversionScore: 70, createdAt: "2026-06-05T00:00:00.000Z", categoryScores: { navigation: 80 } },
  ];

  it("uses the most recently scanned page as the representative for url/device/analysisType/score", () => {
    const result = buildAnalysisResultFromSite("a.com", domainRecords, [], {});
    expect(result.url).toBe("https://a.com");
    expect(result.timestamp).toBe("2026-06-05T00:00:00.000Z");
    expect(result.device).toBe("mobile");
    expect(result.analysisType).toBe("landing-marketing");
    expect(result.conversionScore).toBe(70);
  });

  it("averages category scores across every page of the domain", () => {
    const result = buildAnalysisResultFromSite("a.com", domainRecords, [], {});
    expect(result.benchmark.categoryScores.navigation?.score).toBe(70);
  });

  it("merges friction points across pages via buildSiteFrictionSummary, carrying affectedUrls", () => {
    const items: ActionItem[] = [
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://a.com/pricing", analysisType: "landing-marketing", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 60, status: "open", createdAt: "2026-06-05T00:00:00.000Z" },
    ];

    const result = buildAnalysisResultFromSite("a.com", domainRecords, items, {});

    expect(result.frictionPoints).toHaveLength(1);
    expect(result.frictionPoints[0].affectedUrls).toEqual(["https://a.com/", "https://a.com/pricing"]);
    expect(result.frictionPoints[0].impactScore).toBe(70);
  });

  it("excludes action items belonging to other domains", () => {
    const items: ActionItem[] = [
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "On a.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://b.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "On b.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ];

    const result = buildAnalysisResultFromSite("a.com", domainRecords, items, {});

    expect(result.frictionPoints.map((p) => p.title)).toEqual(["On a.com"]);
  });
});
