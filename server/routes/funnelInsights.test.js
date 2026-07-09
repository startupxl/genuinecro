import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildFunnelInsightsPromptMock = vi.fn(() => "built-prompt");
const callOpenAIMock = vi.fn();

vi.mock("../lib/funnelInsightsPrompt.js", () => ({
  buildFunnelInsightsPrompt: (...args) => buildFunnelInsightsPromptMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const { default: funnelInsightsRouter } = await import("./funnelInsights.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/funnel-insights", funnelInsightsRouter);
  return app;
}

const validBody = {
  steps: [
    { label: "Landing", url: "https://example.com", score: 72, topIssues: ["Weak CTA"] },
    { label: "Checkout", url: "https://example.com/checkout", score: 55, topIssues: ["Too many fields"] },
  ],
};

describe("POST /api/funnel-insights/analyze", () => {
  beforeEach(() => {
    buildFunnelInsightsPromptMock.mockClear();
    callOpenAIMock.mockReset();
  });

  it("returns 400 when fewer than two steps are provided", () => {
    return request(buildApp())
      .post("/api/funnel-insights/analyze")
      .send({ steps: [validBody.steps[0]] })
      .then((res) => {
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, error: "At least two funnel steps are required" });
      });
  });

  it("returns the funnel insights on the happy path", async () => {
    callOpenAIMock.mockResolvedValue({
      weakestStepIndex: 1,
      summary: "The checkout step leaks the most buyers.",
      transitionIssues: ["Landing promises free trial; checkout asks for a card upfront"],
      recommendations: ["Cut checkout form fields from 12 to 5"],
    });

    const res = await request(buildApp()).post("/api/funnel-insights/analyze").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.weakestStepIndex).toBe(1);
    expect(res.body.data.transitionIssues).toHaveLength(1);
    expect(buildFunnelInsightsPromptMock).toHaveBeenCalledWith(validBody.steps);
  });

  it("returns 500 with a clear error when the AI call fails", async () => {
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));

    const res = await request(buildApp()).post("/api/funnel-insights/analyze").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "AI unavailable" });
  });
});
