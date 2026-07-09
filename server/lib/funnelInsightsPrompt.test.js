import { describe, it, expect } from "vitest";
import { buildFunnelInsightsPrompt } from "./funnelInsightsPrompt.js";

const steps = [
  { label: "Landing", url: "https://example.com", score: 72, topIssues: ["Weak call-to-action"] },
  { label: "Pricing", url: "https://example.com/pricing", score: 55, topIssues: ["Confusing plan comparison", "Hidden fees revealed late"] },
  { label: "Checkout", url: "https://example.com/checkout", score: 60, topIssues: ["Too many form fields"] },
];

describe("buildFunnelInsightsPrompt", () => {
  it("includes every step's label, url, score, and top issues in order", () => {
    const prompt = buildFunnelInsightsPrompt(steps);

    expect(prompt.indexOf("Landing")).toBeLessThan(prompt.indexOf("Pricing"));
    expect(prompt.indexOf("Pricing")).toBeLessThan(prompt.indexOf("Checkout"));
    expect(prompt).toContain("https://example.com/pricing");
    expect(prompt).toContain("55");
    expect(prompt).toContain("Hidden fees revealed late");
  });

  it("asks for a JSON response with weakestStepIndex, summary, transitionIssues, and recommendations", () => {
    const prompt = buildFunnelInsightsPrompt(steps);

    expect(prompt).toContain("\"weakestStepIndex\"");
    expect(prompt).toContain("\"summary\"");
    expect(prompt).toContain("\"transitionIssues\"");
    expect(prompt).toContain("\"recommendations\"");
  });
});
