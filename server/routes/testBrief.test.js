import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildTestBriefPromptMock = vi.fn(() => "built-prompt");
const callOpenAIMock = vi.fn();

vi.mock("../lib/testBriefPrompt.js", () => ({
  buildTestBriefPrompt: (...args) => buildTestBriefPromptMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const { default: testBriefRouter } = await import("./testBrief.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/test-brief", testBriefRouter);
  return app;
}

const validBody = {
  hypothesis: "A single, high-contrast CTA will outperform three competing CTAs",
  page: "startupxl.com/pricing",
  goal: "Signups",
  context: "Traffic is roughly 5,000 visitors/week",
};

describe("POST /api/test-brief/generate", () => {
  beforeEach(() => {
    buildTestBriefPromptMock.mockClear();
    callOpenAIMock.mockReset();
  });

  it("returns 400 when hypothesis, page, or goal is missing", () => {
    return request(buildApp())
      .post("/api/test-brief/generate")
      .send({ page: "startupxl.com", goal: "Signups" })
      .then((res) => {
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, error: "A hypothesis, page, and goal are required" });
      });
  });

  it("returns the generated brief on the happy path", async () => {
    callOpenAIMock.mockResolvedValue({
      problemStatement: "Multiple CTAs compete for attention in the hero.",
      hypothesis: validBody.hypothesis,
      successMetric: "Signup conversion rate",
      secondaryMetrics: ["Bounce rate"],
      variants: [
        { name: "Control", description: "Three CTAs of equal visual weight" },
        { name: "Variant A", description: "One primary CTA, others de-emphasized" },
      ],
      audienceAndSplit: "All visitors, 50/50 split",
      estimatedDuration: "3 weeks, based on current traffic",
      risks: ["Seasonal traffic dip could skew results"],
    });

    const res = await request(buildApp()).post("/api/test-brief/generate").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.successMetric).toBe("Signup conversion rate");
    expect(res.body.data.variants).toHaveLength(2);
    expect(buildTestBriefPromptMock).toHaveBeenCalledWith(validBody);
  });

  it("returns 500 with a clear error when the AI call fails", async () => {
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));

    const res = await request(buildApp()).post("/api/test-brief/generate").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "AI unavailable" });
  });
});
