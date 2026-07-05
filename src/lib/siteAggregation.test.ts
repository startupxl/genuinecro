import { describe, it, expect } from "vitest";
import { buildSiteFrictionSummary } from "./siteAggregation";
import type { ActionItem } from "./firebase/actionItems";

function item(overrides: Partial<ActionItem> & Pick<ActionItem, "id" | "url" | "category" | "title" | "impactScore" | "createdAt">): ActionItem {
  return {
    userId: "uid-1",
    analysisType: "homepage",
    severity: "high",
    description: "d",
    fix: "f",
    status: "open",
    ...overrides,
  };
}

describe("buildSiteFrictionSummary", () => {
  it("merges the same issue (category + title) across multiple pages into one row", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "technical-seo", title: "Missing canonical", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/pricing", category: "technical-seo", title: "Missing canonical", impactScore: 60, createdAt: "2026-06-02T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result).toHaveLength(1);
    expect(result[0].affectedUrls).toEqual(["https://a.com/", "https://a.com/pricing"]);
  });

  it("counts a page only once even if it was scanned multiple times with the same issue", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 70, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 75, createdAt: "2026-06-05T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result).toHaveLength(1);
    expect(result[0].affectedUrls).toEqual(["https://a.com/"]);
  });

  it("averages the impact score across occurrences, rounded", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/pricing", category: "navigation", title: "Confusing nav", impactScore: 61, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result[0].avgImpactScore).toBe(71);
  });

  it("keeps the highest severity seen across occurrences", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", severity: "low", impactScore: 30, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/pricing", category: "navigation", title: "Confusing nav", severity: "high", impactScore: 90, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result[0].severity).toBe("high");
  });

  it("uses the most recent occurrence as the representative for description/fix/evidence fields", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", description: "old desc", fix: "old fix", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/pricing", category: "navigation", title: "Confusing nav", description: "new desc", fix: "new fix", impactScore: 60, createdAt: "2026-06-10T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result[0].description).toBe("new desc");
    expect(result[0].fix).toBe("new fix");
  });

  it("carries over selector, benchmark, and abTest from the representative occurrence", () => {
    const items = [
      item({
        id: "1",
        url: "https://a.com/",
        category: "ux-clarity",
        title: "Weak headline",
        impactScore: 90,
        createdAt: "2026-06-05T00:00:00.000Z",
        selector: "header > h1",
        benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity" },
        abTest: { testName: "Headline Test", hypothesis: "h", control: "c", variant: "v", metric: "m", duration: "2 weeks" },
      }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result[0].selector).toBe("header > h1");
    expect(result[0].benchmark).toEqual({ industryAvg: 55, topPerformers: 80, label: "Headline clarity" });
    expect(result[0].abTest?.testName).toBe("Headline Test");
  });

  it("filters to only the given domain", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://b.com/", category: "navigation", title: "Confusing nav", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result).toHaveLength(1);
    expect(result[0].affectedUrls).toEqual(["https://a.com/"]);
  });

  it("excludes resolved action items", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z", status: "resolved" }),
    ];

    expect(buildSiteFrictionSummary(items, "a.com")).toEqual([]);
  });

  it("keeps distinct titles within the same category as separate rows", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Confusing nav", impactScore: 80, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/", category: "navigation", title: "Broken breadcrumbs", impactScore: 50, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    expect(buildSiteFrictionSummary(items, "a.com")).toHaveLength(2);
  });

  it("sorts rows by average impact score, descending", () => {
    const items = [
      item({ id: "1", url: "https://a.com/", category: "navigation", title: "Low impact", impactScore: 20, createdAt: "2026-06-01T00:00:00.000Z" }),
      item({ id: "2", url: "https://a.com/", category: "navigation", title: "High impact", impactScore: 90, createdAt: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = buildSiteFrictionSummary(items, "a.com");

    expect(result.map((r) => r.title)).toEqual(["High impact", "Low impact"]);
  });

  it("returns an empty array when there are no matching items", () => {
    expect(buildSiteFrictionSummary([], "a.com")).toEqual([]);
  });
});
