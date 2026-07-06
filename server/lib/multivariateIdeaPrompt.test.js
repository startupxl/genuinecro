import { describe, it, expect } from "vitest";
import { buildMultivariateIdeaPrompt } from "./multivariateIdeaPrompt.js";

describe("buildMultivariateIdeaPrompt", () => {
  it("includes the base idea, page context, and goal in the prompt", () => {
    const prompt = buildMultivariateIdeaPrompt({
      baseIdea: "Make the CTA button more prominent",
      pageContext: "Homepage hero section",
      goal: "Signups",
    });

    expect(prompt).toContain("Make the CTA button more prominent");
    expect(prompt).toContain("Homepage hero section");
    expect(prompt).toContain("Signups");
  });

  it("asks for a JSON response with factors, suggestedCombinations, and a testingNote", () => {
    const prompt = buildMultivariateIdeaPrompt({
      baseIdea: "Make the CTA button more prominent",
      pageContext: "Homepage hero section",
      goal: "Signups",
    });

    expect(prompt).toContain("\"factors\"");
    expect(prompt).toContain("\"suggestedCombinations\"");
    expect(prompt).toContain("\"testingNote\"");
  });
});
