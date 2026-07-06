import { describe, it, expect } from "vitest";
import { buildTestBriefPrompt } from "./testBriefPrompt.js";

describe("buildTestBriefPrompt", () => {
  it("includes the hypothesis, page, goal, and context in the prompt", () => {
    const prompt = buildTestBriefPrompt({
      hypothesis: "A single, high-contrast CTA will outperform three competing CTAs",
      page: "stripe.com/pricing",
      goal: "Signups",
      context: "Traffic is roughly 5,000 visitors/week",
    });

    expect(prompt).toContain("A single, high-contrast CTA will outperform three competing CTAs");
    expect(prompt).toContain("stripe.com/pricing");
    expect(prompt).toContain("Signups");
    expect(prompt).toContain("Traffic is roughly 5,000 visitors/week");
  });

  it("asks for a JSON response with the full test brief structure", () => {
    const prompt = buildTestBriefPrompt({
      hypothesis: "h",
      page: "p",
      goal: "g",
      context: "",
    });

    expect(prompt).toContain("\"problemStatement\"");
    expect(prompt).toContain("\"hypothesis\"");
    expect(prompt).toContain("\"successMetric\"");
    expect(prompt).toContain("\"secondaryMetrics\"");
    expect(prompt).toContain("\"variants\"");
    expect(prompt).toContain("\"audienceAndSplit\"");
    expect(prompt).toContain("\"estimatedDuration\"");
    expect(prompt).toContain("\"risks\"");
  });
});
