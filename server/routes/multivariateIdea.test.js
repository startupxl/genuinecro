import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildMultivariateIdeaPromptMock = vi.fn(() => "built-prompt");
const callOpenAIMock = vi.fn();

vi.mock("../lib/multivariateIdeaPrompt.js", () => ({
  buildMultivariateIdeaPrompt: (...args) => buildMultivariateIdeaPromptMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const { default: multivariateIdeaRouter } = await import("./multivariateIdea.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/multivariate-idea", multivariateIdeaRouter);
  return app;
}

const validBody = {
  baseIdea: "Make the CTA button more prominent",
  pageContext: "Homepage hero section",
  goal: "Signups",
};

describe("POST /api/multivariate-idea/expand", () => {
  beforeEach(() => {
    buildMultivariateIdeaPromptMock.mockClear();
    callOpenAIMock.mockReset();
  });

  it("returns 400 when baseIdea is missing", () => {
    return request(buildApp())
      .post("/api/multivariate-idea/expand")
      .send({ pageContext: "Homepage", goal: "Signups" })
      .then((res) => {
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, error: "A base idea, page context, and goal are required" });
      });
  });

  it("returns the expanded idea on the happy path", async () => {
    callOpenAIMock.mockResolvedValue({
      factors: [{ name: "CTA Color", levels: ["Control: teal", "Alternative: orange"] }],
      suggestedCombinations: [{ label: "Combination 1", description: "orange + new copy", rationale: "high contrast" }],
      testingNote: "Consider a fractional design if traffic is limited.",
    });

    const res = await request(buildApp()).post("/api/multivariate-idea/expand").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.factors).toHaveLength(1);
    expect(res.body.data.suggestedCombinations).toHaveLength(1);
    expect(res.body.data.testingNote).toContain("fractional design");
    expect(buildMultivariateIdeaPromptMock).toHaveBeenCalledWith(validBody);
  });

  it("returns 500 with a clear error when the AI call fails", async () => {
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));

    const res = await request(buildApp()).post("/api/multivariate-idea/expand").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "AI unavailable" });
  });
});
