import { describe, it, expect } from "vitest";
import {
  buildScoreTrendData,
  buildCategoryBreakdown,
  getSeverityBand,
  buildSeverityBreakdown,
  buildPageBreakdown,
  buildHeroScoreSummary,
  buildCategoryScoreBreakdown,
  CATEGORY_BENCHMARKS,
  buildIssueMomentum,
  getNextAnalysisCreatedAt,
  filterActionItemsForScan,
  buildAuditsList,
  buildKeyMetricsSummary,
} from "./dashboardMetrics";
import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem } from "./firebase/actionItems";
import type { SiteSummary } from "./firebase/analyses";

function buildAnalysis(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    url: "https://example.com",
    analysisType: "homepage",
    device: "desktop",
    conversionScore: 60,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildActionItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "item-1",
    userId: "uid-1",
    url: "https://example.com",
    analysisType: "homepage",
    category: "ux-clarity",
    severity: "high",
    title: "Weak headline",
    description: "d",
    fix: "f",
    impactScore: 80,
    status: "open",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildScoreTrendData", () => {
  it("sorts analyses chronologically ascending", () => {
    const analyses = [
      buildAnalysis({ createdAt: "2026-06-03T00:00:00.000Z", conversionScore: 70 }),
      buildAnalysis({ createdAt: "2026-06-01T00:00:00.000Z", conversionScore: 50 }),
      buildAnalysis({ createdAt: "2026-06-02T00:00:00.000Z", conversionScore: 60 }),
    ];

    const result = buildScoreTrendData(analyses, null);

    expect(result.map((p) => p.score)).toEqual([50, 60, 70]);
  });

  it("excludes technical audits", () => {
    const analyses = [
      buildAnalysis({ analysisType: "homepage", conversionScore: 60 }),
      buildAnalysis({ analysisType: "technical", conversionScore: 90 }),
    ];

    const result = buildScoreTrendData(analyses, null);

    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(60);
  });

  it("filters to a single domain when one is given", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", conversionScore: 40 }),
      buildAnalysis({ url: "https://b.com", conversionScore: 90 }),
      buildAnalysis({ url: "https://www.a.com/page", conversionScore: 45 }),
    ];

    const result = buildScoreTrendData(analyses, "a.com");

    expect(result.map((p) => p.score)).toEqual([40, 45]);
  });

  it("returns an empty array for no analyses", () => {
    expect(buildScoreTrendData([], null)).toEqual([]);
  });
});

describe("buildCategoryBreakdown", () => {
  it("counts items per category and sorts descending by count", () => {
    const items = [
      buildActionItem({ category: "ux-clarity" }),
      buildActionItem({ category: "trust-credibility" }),
      buildActionItem({ category: "ux-clarity" }),
      buildActionItem({ category: "ux-clarity" }),
    ];

    const result = buildCategoryBreakdown(items, null);

    expect(result[0]).toEqual({ category: "ux-clarity", label: "UX Clarity", count: 3 });
    expect(result[1]).toEqual({ category: "trust-credibility", label: "Trust & Credibility", count: 1 });
  });

  it("filters to a single domain when one is given", () => {
    const items = [
      buildActionItem({ url: "https://a.com", category: "ux-clarity" }),
      buildActionItem({ url: "https://b.com", category: "trust-credibility" }),
    ];

    const result = buildCategoryBreakdown(items, "a.com");

    expect(result).toEqual([{ category: "ux-clarity", label: "UX Clarity", count: 1 }]);
  });

  it("falls back to the raw category string when no label is known", () => {
    const items = [buildActionItem({ category: "some-unknown-category" })];

    const result = buildCategoryBreakdown(items, null);

    expect(result).toEqual([{ category: "some-unknown-category", label: "some-unknown-category", count: 1 }]);
  });

  it("returns an empty array for no items", () => {
    expect(buildCategoryBreakdown([], null)).toEqual([]);
  });
});

describe("getSeverityBand", () => {
  it("bands scores into Critical / Needs Work / Good / Excellent", () => {
    expect(getSeverityBand(0)).toBe("Critical");
    expect(getSeverityBand(49)).toBe("Critical");
    expect(getSeverityBand(50)).toBe("Needs Work");
    expect(getSeverityBand(69)).toBe("Needs Work");
    expect(getSeverityBand(70)).toBe("Good");
    expect(getSeverityBand(89)).toBe("Good");
    expect(getSeverityBand(90)).toBe("Excellent");
    expect(getSeverityBand(100)).toBe("Excellent");
  });
});

describe("buildSeverityBreakdown", () => {
  it("counts items per severity in fixed Critical/Warning/Info order", () => {
    const items = [
      buildActionItem({ severity: "low" }),
      buildActionItem({ severity: "high" }),
      buildActionItem({ severity: "high" }),
      buildActionItem({ severity: "med" }),
    ];

    const result = buildSeverityBreakdown(items, null);

    expect(result).toEqual([
      { category: "high", label: "Critical", count: 2, barColorClass: "bg-friction-high" },
      { category: "med", label: "Warning", count: 1, barColorClass: "bg-friction-med" },
      { category: "low", label: "Info", count: 1, barColorClass: "bg-friction-low" },
    ]);
  });

  it("omits severities with zero items", () => {
    const items = [buildActionItem({ severity: "high" })];

    const result = buildSeverityBreakdown(items, null);

    expect(result).toEqual([{ category: "high", label: "Critical", count: 1, barColorClass: "bg-friction-high" }]);
  });

  it("filters to a single domain when one is given", () => {
    const items = [
      buildActionItem({ url: "https://a.com", severity: "high" }),
      buildActionItem({ url: "https://b.com", severity: "low" }),
    ];

    const result = buildSeverityBreakdown(items, "a.com");

    expect(result).toEqual([{ category: "high", label: "Critical", count: 1, barColorClass: "bg-friction-high" }]);
  });
});

describe("buildPageBreakdown", () => {
  it("returns one row per distinct URL using the most recent record", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com/", analysisType: "homepage", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ url: "https://a.com/", analysisType: "homepage", conversionScore: 55, createdAt: "2026-06-05T00:00:00.000Z" }),
      buildAnalysis({ url: "https://a.com/checkout", analysisType: "checkout", conversionScore: 80, createdAt: "2026-06-02T00:00:00.000Z" }),
    ];

    const result = buildPageBreakdown(analyses, []);

    expect(result).toHaveLength(2);
    const home = result.find((r) => r.url === "https://a.com/");
    expect(home).toMatchObject({ score: 55, analysisType: "homepage", domain: "a.com" });
  });

  it("counts open issues per exact URL", () => {
    const analyses = [buildAnalysis({ url: "https://a.com/", conversionScore: 40 })];
    const items = [
      buildActionItem({ url: "https://a.com/", status: "open" }),
      buildActionItem({ url: "https://a.com/", status: "open" }),
      buildActionItem({ url: "https://a.com/", status: "resolved" }),
      buildActionItem({ url: "https://b.com/", status: "open" }),
    ];

    const result = buildPageBreakdown(analyses, items);

    expect(result[0].issueCount).toBe(2);
  });

  it("counts in-progress issues alongside open ones, but not resolved ones", () => {
    const analyses = [buildAnalysis({ url: "https://a.com/", conversionScore: 40 })];
    const items = [
      buildActionItem({ url: "https://a.com/", status: "open" }),
      buildActionItem({ url: "https://a.com/", status: "in_progress" }),
      buildActionItem({ url: "https://a.com/", status: "resolved" }),
    ];

    const result = buildPageBreakdown(analyses, items);

    expect(result[0].issueCount).toBe(2);
  });

  it("excludes technical audits", () => {
    const analyses = [buildAnalysis({ url: "https://a.com/", analysisType: "technical" })];

    const result = buildPageBreakdown(analyses, []);

    expect(result).toEqual([]);
  });

  it("sorts by most recently crawled first", () => {
    const analyses = [
      buildAnalysis({ url: "https://old.com/", createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ url: "https://new.com/", createdAt: "2026-06-05T00:00:00.000Z" }),
    ];

    const result = buildPageBreakdown(analyses, []);

    expect(result.map((r) => r.url)).toEqual(["https://new.com/", "https://old.com/"]);
  });
});

describe("buildHeroScoreSummary", () => {
  function buildSite(overrides: Partial<SiteSummary> = {}): SiteSummary {
    return {
      domain: "a.com",
      latestScore: 60,
      previousScore: null,
      scoreDelta: null,
      lastAnalyzedAt: "2026-06-01T00:00:00.000Z",
      analysisCount: 1,
      ...overrides,
    };
  }

  it("averages latest scores across sites for the overall score and band", () => {
    const sites = [buildSite({ latestScore: 40 }), buildSite({ domain: "b.com", latestScore: 80 })];
    const analyses = [buildAnalysis({ conversionScore: 40 }), buildAnalysis({ conversionScore: 80 })];

    const summary = buildHeroScoreSummary(sites, analyses);

    expect(summary.overallScore).toBe(60);
    expect(summary.band).toBe("Needs Work");
  });

  it("averages the trend delta only across sites that have one", () => {
    const sites = [
      buildSite({ scoreDelta: 10 }),
      buildSite({ domain: "b.com", scoreDelta: null }),
      buildSite({ domain: "c.com", scoreDelta: 20 }),
    ];

    const summary = buildHeroScoreSummary(sites, []);

    expect(summary.trendDelta).toBe(15);
  });

  it("returns a null trend delta when no site has one yet", () => {
    const sites = [buildSite({ scoreDelta: null })];

    const summary = buildHeroScoreSummary(sites, []);

    expect(summary.trendDelta).toBeNull();
  });

  it("counts pages audited as non-technical analyses, and reports the most recent audit date", () => {
    const analyses = [
      buildAnalysis({ analysisType: "homepage", createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ analysisType: "checkout", createdAt: "2026-06-05T00:00:00.000Z" }),
      buildAnalysis({ analysisType: "technical", createdAt: "2026-06-10T00:00:00.000Z" }),
    ];

    const summary = buildHeroScoreSummary([], analyses);

    expect(summary.pagesAudited).toBe(2);
    expect(summary.lastAuditAt).toBe("2026-06-05T00:00:00.000Z");
  });

  it("returns sensible defaults with no data at all", () => {
    const summary = buildHeroScoreSummary([], []);

    expect(summary).toEqual({
      overallScore: 0,
      trendDelta: null,
      band: "Critical",
      pagesAudited: 0,
      lastAuditAt: null,
    });
  });
});

describe("buildCategoryScoreBreakdown", () => {
  it("averages category scores across analyses and computes delta vs. the static benchmark", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", categoryScores: { "content-hierarchy": 40 } }),
      buildAnalysis({ url: "https://b.com", categoryScores: { "content-hierarchy": 60 } }),
    ];

    const result = buildCategoryScoreBreakdown(analyses, null);

    const entry = result.find((r) => r.category === "content-hierarchy")!;
    expect(entry.score).toBe(50);
    expect(entry.label).toBe("Content Hierarchy");
    expect(entry.deltaVsBenchmark).toBe(50 - CATEGORY_BENCHMARKS["content-hierarchy"].accountAvg);
  });

  it("counts distinct sites contributing to each category and identifies the worst site", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", categoryScores: { navigation: 70 } }),
      buildAnalysis({ url: "https://b.com", categoryScores: { navigation: 30 } }),
    ];

    const result = buildCategoryScoreBreakdown(analyses, null);

    const entry = result.find((r) => r.category === "navigation")!;
    expect(entry.siteCount).toBe(2);
    expect(entry.worstSite).toEqual({ url: "https://b.com", score: 30 });
  });

  it("sorts categories worst delta first", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", categoryScores: { "content-hierarchy": 90, navigation: 10 } }),
    ];

    const result = buildCategoryScoreBreakdown(analyses, null);

    expect(result[0].category).toBe("navigation");
  });

  it("ignores analyses with no categoryScores and excludes technical audits", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", categoryScores: undefined }),
      buildAnalysis({ url: "https://b.com", analysisType: "technical", categoryScores: { navigation: 90 } }),
    ];

    expect(buildCategoryScoreBreakdown(analyses, null)).toEqual([]);
  });

  it("filters to a single domain when one is given", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", categoryScores: { navigation: 70 } }),
      buildAnalysis({ url: "https://b.com", categoryScores: { navigation: 30 } }),
    ];

    const result = buildCategoryScoreBreakdown(analyses, "a.com");

    expect(result.find((r) => r.category === "navigation")!.score).toBe(70);
  });

  it("uses the live benchmark figure once a category has enough samples", () => {
    const analyses = [buildAnalysis({ url: "https://a.com", categoryScores: { navigation: 70 } })];

    const result = buildCategoryScoreBreakdown(analyses, null, {
      navigation: { accountAvg: 40, topQuartile: 90, sampleCount: 10 },
    });

    expect(result.find((r) => r.category === "navigation")!.deltaVsBenchmark).toBe(30);
  });

  it("falls back to the static benchmark when live samples are too few", () => {
    const analyses = [buildAnalysis({ url: "https://a.com", categoryScores: { navigation: 70 } })];

    const result = buildCategoryScoreBreakdown(analyses, null, {
      navigation: { accountAvg: 10, topQuartile: 20, sampleCount: 1 },
    });

    expect(result.find((r) => r.category === "navigation")!.deltaVsBenchmark).toBe(
      70 - CATEGORY_BENCHMARKS.navigation.accountAvg
    );
  });

  it("falls back to the static benchmark when no live benchmark exists for that category", () => {
    const analyses = [buildAnalysis({ url: "https://a.com", categoryScores: { navigation: 70 } })];

    const result = buildCategoryScoreBreakdown(analyses, null, {});

    expect(result.find((r) => r.category === "navigation")!.deltaVsBenchmark).toBe(
      70 - CATEGORY_BENCHMARKS.navigation.accountAvg
    );
  });
});

describe("buildIssueMomentum", () => {
  it("counts items created after the second-most-recent audit as new", () => {
    const analyses = [
      buildAnalysis({ createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ createdAt: "2026-06-05T00:00:00.000Z" }),
    ];
    const items = [
      buildActionItem({ createdAt: "2026-06-01T00:00:00.000Z" }),
      buildActionItem({ createdAt: "2026-06-05T00:00:00.000Z" }),
    ];

    const momentum = buildIssueMomentum(items, analyses, null);

    expect(momentum.newSinceLastScan).toBe(1);
  });

  it("counts items resolved after the second-most-recent audit", () => {
    const analyses = [
      buildAnalysis({ createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ createdAt: "2026-06-05T00:00:00.000Z" }),
    ];
    const items = [
      buildActionItem({ status: "resolved", resolvedAt: "2026-06-06T00:00:00.000Z" }),
      buildActionItem({ status: "resolved", resolvedAt: "2025-01-01T00:00:00.000Z" }),
      buildActionItem({ status: "open" }),
    ];

    const momentum = buildIssueMomentum(items, analyses, null);

    expect(momentum.resolvedSinceLastScan).toBe(1);
  });

  it("returns zeroes when there's no second-most-recent audit yet", () => {
    const analyses = [buildAnalysis({ createdAt: "2026-06-01T00:00:00.000Z" })];
    const items = [buildActionItem({ createdAt: "2026-06-01T00:00:00.000Z" })];

    expect(buildIssueMomentum(items, analyses, null)).toEqual({ newSinceLastScan: 0, resolvedSinceLastScan: 0 });
  });

  it("filters to a single domain when one is given", () => {
    const analyses = [
      buildAnalysis({ url: "https://a.com", createdAt: "2026-06-01T00:00:00.000Z" }),
      buildAnalysis({ url: "https://a.com", createdAt: "2026-06-05T00:00:00.000Z" }),
    ];
    const items = [
      buildActionItem({ url: "https://a.com", createdAt: "2026-06-06T00:00:00.000Z" }),
      buildActionItem({ url: "https://b.com", createdAt: "2026-06-06T00:00:00.000Z" }),
    ];

    const momentum = buildIssueMomentum(items, analyses, "a.com");

    expect(momentum.newSinceLastScan).toBe(1);
  });
});

describe("getNextAnalysisCreatedAt", () => {
  it("returns the createdAt of the next-chronological analysis for the same url", () => {
    const analyses = [
      { url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 55, createdAt: "2026-06-05T00:00:00.000Z" },
    ];

    expect(getNextAnalysisCreatedAt(analyses, "https://a.com", "2026-06-01T00:00:00.000Z")).toBe(
      "2026-06-05T00:00:00.000Z"
    );
  });

  it("returns null when the given scan is the most recent for that url", () => {
    const analyses = [
      { url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 55, createdAt: "2026-06-05T00:00:00.000Z" },
    ];

    expect(getNextAnalysisCreatedAt(analyses, "https://a.com", "2026-06-05T00:00:00.000Z")).toBeNull();
  });
});

describe("filterActionItemsForScan", () => {
  it("keeps only items for the given url created within the scan's time window, sorted by impact", () => {
    const items = [
      buildActionItem({ id: "1", url: "https://a.com", impactScore: 50, createdAt: "2026-06-01T00:00:00.000Z" }),
      buildActionItem({ id: "2", url: "https://a.com", impactScore: 90, createdAt: "2026-06-02T00:00:00.000Z" }),
      buildActionItem({ id: "3", url: "https://a.com", impactScore: 70, createdAt: "2026-06-06T00:00:00.000Z" }),
      buildActionItem({ id: "4", url: "https://b.com", impactScore: 99, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = filterActionItemsForScan(items, "https://a.com", "2026-06-01T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    expect(result.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("includes everything from the scan's start onward when there is no next scan", () => {
    const items = [
      buildActionItem({ id: "1", url: "https://a.com", createdAt: "2026-06-01T00:00:00.000Z" }),
      buildActionItem({ id: "2", url: "https://a.com", createdAt: "2026-12-01T00:00:00.000Z" }),
    ];

    const result = filterActionItemsForScan(items, "https://a.com", "2026-06-01T00:00:00.000Z", null);

    expect(result).toHaveLength(2);
  });
});

describe("buildAuditsList", () => {
  it("returns one entry per scan (including technical), newest first", () => {
    const analyses = [
      { id: "a1", url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "a2", url: "https://a.com", analysisType: "technical", device: "desktop", conversionScore: 90, createdAt: "2026-06-02T00:00:00.000Z" },
    ];

    const result = buildAuditsList(analyses, [], null);

    expect(result.map((r) => r.id)).toEqual(["a2", "a1"]);
  });

  it("computes scoreDelta vs the previous scan of the same exact url, null for the first ever scan", () => {
    const analyses = [
      { id: "a1", url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "a2", url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 55, createdAt: "2026-06-05T00:00:00.000Z" },
    ];

    const result = buildAuditsList(analyses, [], null);

    expect(result.find((r) => r.id === "a1")!.scoreDelta).toBeNull();
    expect(result.find((r) => r.id === "a2")!.scoreDelta).toBe(15);
  });

  it("counts issues created within that scan's window and flags critical scores under 50", () => {
    const analyses = [
      { id: "a1", url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
    ];
    const items = [
      buildActionItem({ url: "https://a.com", createdAt: "2026-06-01T01:00:00.000Z" }),
      buildActionItem({ url: "https://a.com", createdAt: "2026-06-01T02:00:00.000Z" }),
    ];

    const result = buildAuditsList(analyses, items, null);

    expect(result[0].issueCount).toBe(2);
    expect(result[0].isCritical).toBe(true);
  });

  it("filters to a single domain when one is given", () => {
    const analyses = [
      { id: "a1", url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 40, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "b1", url: "https://b.com", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-02T00:00:00.000Z" },
    ];

    const result = buildAuditsList(analyses, [], "a.com");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });
});

describe("buildKeyMetricsSummary", () => {
  it("counts every friction point ever identified, regardless of status", () => {
    const items = [
      { id: "1", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "high", title: "t1", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "med", title: "t2", description: "d", fix: "f", impactScore: 60, status: "resolved", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "3", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "low", title: "t3", description: "d", fix: "f", impactScore: 40, status: "in_progress", createdAt: "2026-06-01T00:00:00.000Z" },
    ];

    expect(buildKeyMetricsSummary(items).totalFrictionPoints).toBe(3);
  });

  it("counts action items that carry an A/B test recommendation", () => {
    const items = [
      { id: "1", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "high", title: "t1", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z", abTest: { testName: "Nav Test", hypothesis: "h", control: "c", variant: "v", metric: "m", duration: "2 weeks" } },
      { id: "2", userId: "u", url: "https://a.com", analysisType: "homepage", category: "technical-seo", severity: "med", title: "t2", description: "d", fix: "f", impactScore: 60, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ];

    expect(buildKeyMetricsSummary(items).abTestsRecommended).toBe(1);
  });

  it("does not count an abTest with an empty testName as a recommendation", () => {
    const items = [
      { id: "1", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "high", title: "t1", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z", abTest: { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" } },
    ];

    expect(buildKeyMetricsSummary(items).abTestsRecommended).toBe(0);
  });

  it("counts resolved issues", () => {
    const items = [
      { id: "1", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "high", title: "t1", description: "d", fix: "f", impactScore: 80, status: "resolved", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", userId: "u", url: "https://a.com", analysisType: "homepage", category: "navigation", severity: "med", title: "t2", description: "d", fix: "f", impactScore: 60, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ];

    expect(buildKeyMetricsSummary(items).issuesResolved).toBe(1);
  });

  it("returns all zeros for an empty list", () => {
    expect(buildKeyMetricsSummary([])).toEqual({
      totalFrictionPoints: 0,
      abTestsRecommended: 0,
      issuesResolved: 0,
    });
  });
});
