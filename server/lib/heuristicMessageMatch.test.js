import { describe, it, expect } from "vitest";
import { generateHeuristicMessageMatch } from "./heuristicMessageMatch.js";

describe("generateHeuristicMessageMatch", () => {
  it("scores a strong match when the page content contains the source message's keywords", () => {
    const result = generateHeuristicMessageMatch(
      "Get 50% off premium widgets today",
      "# Premium Widgets — 50% Off Today\nShop our best deals now.",
      "https://example.com"
    );
    expect(result.matchScore).toBeGreaterThanOrEqual(80);
    expect(result.verdict).toBe("Strong Match");
  });

  it("scores a mismatch when the page content shares none of the source message's keywords", () => {
    const result = generateHeuristicMessageMatch(
      "Get 50% off premium widgets today",
      "# Enterprise Cloud Security Solutions\nProtect your infrastructure.",
      "https://example.com"
    );
    expect(result.matchScore).toBeLessThan(50);
    expect(result.verdict).toBe("Mismatch");
  });

  it("extracts the page's first heading as pageHeadline", () => {
    const result = generateHeuristicMessageMatch("Some ad", "# The Real Headline\nBody text.", "https://example.com");
    expect(result.pageHeadline).toBe("The Real Headline");
  });

  it("falls back to the first non-empty line when there is no markdown heading", () => {
    const result = generateHeuristicMessageMatch("Some ad", "Just plain text with no heading.", "https://example.com");
    expect(result.pageHeadline).toBe("Just plain text with no heading.");
  });

  it("lists specific missing keywords as misaligned elements when the match is weak", () => {
    const result = generateHeuristicMessageMatch(
      "Get 50% off premium widgets today",
      "# Enterprise Cloud Security Solutions",
      "https://example.com"
    );
    expect(result.misalignedElements.length).toBeGreaterThan(0);
    expect(result.misalignedElements[0].toLowerCase()).toContain("widgets");
  });
});
