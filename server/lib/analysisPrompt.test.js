import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt, SCORING_CATEGORIES } from "./analysisPrompt.js";

describe("buildAnalysisPrompt", () => {
  it("includes the URL, page type label, and device in the prompt", () => {
    const prompt = buildAnalysisPrompt("checkout", "# Some page content", "https://example.com", "desktop");
    expect(prompt).toContain("URL: https://example.com");
    expect(prompt).toContain("Page Type: Checkout");
    expect(prompt).toContain("Device: DESKTOP");
  });

  it("uses mobile-specific guidance for the mobile device", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "mobile");
    expect(prompt).toContain("MOBILE experience");
    expect(prompt).toContain("touch targets (44px min)");
  });

  it("uses desktop-specific guidance for the desktop device", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "desktop");
    expect(prompt).toContain("DESKTOP experience");
  });

  it("truncates page content to 14000 characters", () => {
    const longMarkdown = "x".repeat(20000);
    const prompt = buildAnalysisPrompt("homepage", longMarkdown, "https://example.com", "desktop");
    const contentSection = prompt.split("PAGE CONTENT:\n")[1];
    expect(contentSection.length).toBe(14000);
  });

  it("falls back to homepage emphasis for an unrecognized analysis type", () => {
    const prompt = buildAnalysisPrompt("unknown-type", "content", "https://example.com", "desktop");
    expect(prompt).toContain("Homepage is the gateway");
  });

  it("includes the named evidence-based criteria for homepage", () => {
    const prompt = buildAnalysisPrompt("homepage", "# Some content", "https://example.com", "desktop");
    expect(prompt).toContain("NAMED EVIDENCE-BASED CRITERIA");
    expect(prompt).toContain("homepage-001");
    expect(prompt).toContain("Nielsen Norman Group");
  });

  it("includes the named evidence-based criteria for checkout", () => {
    const prompt = buildAnalysisPrompt("checkout", "# Some content", "https://example.com", "desktop");
    expect(prompt).toContain("NAMED EVIDENCE-BASED CRITERIA");
    expect(prompt).toContain("checkout-001");
    expect(prompt).toContain("Baymard Institute");
  });

  it("does not include the evidence-based criteria section for other page types", () => {
    const prompt = buildAnalysisPrompt("product-page", "# Some content", "https://example.com", "desktop");
    expect(prompt).not.toContain("NAMED EVIDENCE-BASED CRITERIA");
  });

  it("defines exactly the 10 new taxonomy categories, weighted to sum to 1", () => {
    const keys = Object.keys(SCORING_CATEGORIES);
    expect(keys).toEqual([
      "content-hierarchy", "navigation", "performance", "accessibility", "visual-friction",
      "ux-friction", "trust-credibility", "form-friction", "cta-effectiveness", "checkout-friction",
    ]);
    const totalWeight = keys.reduce((sum, k) => sum + SCORING_CATEGORIES[k].weight, 0);
    expect(Math.round(totalWeight * 100) / 100).toBe(1);
  });

  it("lists the new category keys in the friction-point category instruction", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "desktop");
    expect(prompt).toContain('"content-hierarchy"');
    expect(prompt).toContain('"checkout-friction"');
    expect(prompt).not.toContain('"ux-clarity"');
    expect(prompt).not.toContain('"funnel-health"');
  });

  it("requires a durationRationale grounded in the device's baseline conversion rate, not a bare guess", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "desktop");
    expect(prompt).toContain("durationRationale");
    expect(prompt).toContain("never give a bare guess");
    expect(prompt).toContain("conversions per variant");
  });
});
