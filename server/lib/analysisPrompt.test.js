import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt } from "./analysisPrompt.js";

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
});
