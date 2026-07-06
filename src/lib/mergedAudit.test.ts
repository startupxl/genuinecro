import { describe, it, expect, vi, beforeEach } from "vitest";

const analyzeUrlMock = vi.fn();
vi.mock("./api/analyze", () => ({
  analyzeUrl: (...args: unknown[]) => analyzeUrlMock(...args),
}));

const runTechnicalAuditMock = vi.fn();
vi.mock("./api/technical", () => ({
  runTechnicalAudit: (...args: unknown[]) => runTechnicalAuditMock(...args),
}));

import { CATEGORY_TAB, getCategoryTab, combineScores, runMergedAudit } from "./mergedAudit";

describe("getCategoryTab", () => {
  it("maps technical-seo to the Technical tab", () => {
    expect(getCategoryTab("technical-seo")).toBe("Technical");
  });

  it("maps content-hierarchy to the Content tab", () => {
    expect(getCategoryTab("content-hierarchy")).toBe("Content");
  });

  it("maps navigation, accessibility, and performance to their own standalone tabs", () => {
    expect(getCategoryTab("navigation")).toBe("Navigation");
    expect(getCategoryTab("accessibility")).toBe("Accessibility");
    expect(getCategoryTab("performance")).toBe("Performance");
  });

  it("maps the remaining five conversion-side categories to the Conversion tab", () => {
    ["visual-friction", "ux-friction", "form-friction", "cta-effectiveness", "checkout-friction"].forEach((cat) => {
      expect(getCategoryTab(cat)).toBe("Conversion");
    });
  });

  it("maps trust-credibility to its own standalone tab", () => {
    expect(getCategoryTab("trust-credibility")).toBe("Trust & Credibility");
  });

  it("falls back to the Conversion tab for an unrecognized category", () => {
    expect(getCategoryTab("some-unknown-category")).toBe("Conversion");
  });

  it("exposes the full mapping table", () => {
    expect(CATEGORY_TAB["technical-seo"]).toBe("Technical");
  });
});

describe("combineScores", () => {
  it("weights technical at 15% and conversion at 85%", () => {
    expect(combineScores(100, 0)).toBe(15);
    expect(combineScores(0, 100)).toBe(85);
    expect(combineScores(80, 60)).toBe(Math.round(80 * 0.15 + 60 * 0.85));
  });

  it("falls back to the conversion score alone when technical is null (e.g. technical audit failed)", () => {
    expect(combineScores(null, 72)).toBe(72);
  });
});

const mockConversionResult = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 60,
  benchmark: { overallScore: 60, industryAvg: 55, topQuartile: 78, categoryScores: {} },
  frictionPoints: [
    { id: "fp-1", category: "navigation", severity: "high", title: "Nav issue", description: "d", selector: "nav", fix: "f", impactScore: 80, benchmark: { industryAvg: 50, topPerformers: 80, label: "x" }, abTest: { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" } },
  ],
};

const mockTechnicalResult = {
  url: "https://example.com",
  technicalScore: 40,
  checks: {
    canonical: { present: true, href: null },
    indexability: { indexable: true, reason: null },
    robotsTxt: { exists: true, valid: true, issue: null },
    sitemap: { exists: true, valid: true, issue: null },
    linkSummary: { total: 10, ok: 10, broken: 0, redirectChains: 0 },
  },
  issues: [
    { category: "technical-seo", severity: "med", title: "Missing canonical", description: "d", fix: "f", impactScore: 50 },
  ],
};

describe("runMergedAudit", () => {
  beforeEach(() => {
    analyzeUrlMock.mockReset();
    runTechnicalAuditMock.mockReset();
  });

  it("passes siteType through to analyzeUrl when provided", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockResolvedValue(mockTechnicalResult);

    await runMergedAudit("https://example.com", "homepage", "desktop", null, "ecommerce");

    expect(analyzeUrlMock).toHaveBeenCalledWith("https://example.com", "homepage", "desktop", "ecommerce");
  });

  it("runs both audits and combines the scores", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockResolvedValue(mockTechnicalResult);

    const result = await runMergedAudit("https://example.com", "homepage", "desktop");

    expect(result.conversionScore).toBe(combineScores(40, 60));
    expect(result.technicalScore).toBe(40);
  });

  it("combines friction points from both audits into one list", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockResolvedValue(mockTechnicalResult);

    const result = await runMergedAudit("https://example.com", "homepage", "desktop");

    expect(result.frictionPoints).toHaveLength(2);
    expect(result.frictionPoints.map((f) => f.category)).toEqual(
      expect.arrayContaining(["navigation", "technical-seo"])
    );
  });

  it("falls back to conversion-only when the technical audit fails, without throwing", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockRejectedValue(new Error("technical audit failed"));

    const result = await runMergedAudit("https://example.com", "homepage", "desktop");

    expect(result.conversionScore).toBe(60);
    expect(result.technicalScore).toBeNull();
    expect(result.frictionPoints).toHaveLength(1);
  });

  it("propagates the error when the real conversion analysis fails, instead of masking it with fake data", async () => {
    analyzeUrlMock.mockRejectedValue(new Error("conversion analysis failed"));
    runTechnicalAuditMock.mockResolvedValue(mockTechnicalResult);

    await expect(runMergedAudit("https://example.com", "homepage", "desktop")).rejects.toThrow(
      "conversion analysis failed"
    );
  });

  it("echoes the conversion goal back on the result", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockResolvedValue(mockTechnicalResult);

    const result = await runMergedAudit("https://example.com", "homepage", "desktop", { type: "lead_form", isMacro: false });

    expect(result.conversionGoal).toEqual({ type: "lead_form", isMacro: false });
  });

  it("re-weights the conversion score by the goal's category weights when category scores are present", async () => {
    const withCategories = {
      ...mockConversionResult,
      benchmark: {
        overallScore: 60,
        industryAvg: 55,
        topQuartile: 78,
        categoryScores: {
          "content-hierarchy": { score: 50, industryAvg: 50 },
          navigation: { score: 50, industryAvg: 50 },
          performance: { score: 50, industryAvg: 50 },
          accessibility: { score: 50, industryAvg: 50 },
          "visual-friction": { score: 50, industryAvg: 50 },
          "ux-friction": { score: 50, industryAvg: 50 },
          "trust-credibility": { score: 90, industryAvg: 50 },
          "form-friction": { score: 90, industryAvg: 50 },
          "cta-effectiveness": { score: 50, industryAvg: 50 },
          "checkout-friction": { score: 50, industryAvg: 50 },
        },
      },
    };
    analyzeUrlMock.mockResolvedValue(withCategories);
    runTechnicalAuditMock.mockRejectedValue(new Error("skip technical for this test"));

    const leadFormResult = await runMergedAudit("https://example.com", "homepage", "desktop", { type: "lead_form", isMacro: false });
    const noGoalResult = await runMergedAudit("https://example.com", "homepage", "desktop", null);

    // lead_form weights trust-credibility + form-friction (both scoring 90 here) higher than the default table.
    expect(leadFormResult.conversionScore).toBeGreaterThan(noGoalResult.conversionScore);
  });

  it("falls back to the AI's own conversion score when no category scores are present", async () => {
    analyzeUrlMock.mockResolvedValue(mockConversionResult);
    runTechnicalAuditMock.mockRejectedValue(new Error("skip technical"));

    const result = await runMergedAudit("https://example.com", "homepage", "desktop", { type: "purchase", isMacro: true });

    expect(result.conversionScore).toBe(60);
  });
});
