import { describe, it, expect } from "vitest";
import { generateHeuristicAnalysis } from "./heuristicAnalysis.js";

describe("generateHeuristicAnalysis", () => {
  it("flags weak content hierarchy when there are fewer than 3 headings", () => {
    const result = generateHeuristicAnalysis("Just some plain text with no headings at all.", "https://example.com", "homepage", "desktop", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Weak content hierarchy");
  });

  it("flags missing pricing on a paid landing page", () => {
    const markdown = "# Welcome\nGet started today with our amazing product for everyone.";
    const result = generateHeuristicAnalysis(markdown, "https://example.com", "landing-paid-media", "desktop", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Paid landing page lacks pricing");
  });

  it("adds mobile-specific tap-target findings on mobile", () => {
    const result = generateHeuristicAnalysis("# Heading\n## Sub\n### Sub2\nGet started now.", "https://example.com", "homepage", "mobile", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Mobile tap targets need review");
  });

  it("computes a conversion score, grade, and sorted friction points", () => {
    const result = generateHeuristicAnalysis("content with no structure", "https://example.com", "homepage", "desktop", "https://shot.example/img.png");
    expect(typeof result.conversionScore).toBe("number");
    expect(result.grade).toBeTruthy();
    expect(result.screenshotUrl).toBe("https://shot.example/img.png");
    for (let i = 1; i < result.frictionPoints.length; i++) {
      expect(result.frictionPoints[i - 1].impactScore).toBeGreaterThanOrEqual(result.frictionPoints[i].impactScore);
    }
  });
});
