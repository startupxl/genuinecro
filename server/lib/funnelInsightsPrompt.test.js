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

  it("includes a step's real GA4 behavioral data when present", () => {
    const stepsWithGa4 = [
      { ...steps[0], ga4: { sessions: 450, bounceRate: 68, engagementRate: 32 } },
      steps[1],
    ];
    const prompt = buildFunnelInsightsPrompt(stepsWithGa4);

    expect(prompt).toContain("450 sessions");
    expect(prompt).toContain("68% bounce rate");
    expect(prompt).toContain("32% engagement rate");
  });

  it("omits any per-step GA4 line for steps without real data, without leaking 'undefined' into the prompt", () => {
    const prompt = buildFunnelInsightsPrompt(steps);

    expect(prompt).not.toContain("undefined");
    expect(prompt).not.toContain("Real GA4 data");
  });

  it("instructs the model to treat real GA4 data as ground truth over the estimated score", () => {
    const prompt = buildFunnelInsightsPrompt(steps);

    expect(prompt.toLowerCase()).toContain("ground truth");
    expect(prompt.toLowerCase()).toContain("bounce rate");
  });
});
