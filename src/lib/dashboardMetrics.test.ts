import { describe, it, expect } from "vitest";
import { buildScoreTrendData, buildCategoryBreakdown } from "./dashboardMetrics";
import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem } from "./firebase/actionItems";

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
