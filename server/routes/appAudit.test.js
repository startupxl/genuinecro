import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildAppAuditPromptMock = vi.fn(() => "built-prompt");
const callOpenAIVisionMock = vi.fn();

vi.mock("../lib/appAuditPrompt.js", () => ({
  buildAppAuditPrompt: (...args) => buildAppAuditPromptMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAIVision: (...args) => callOpenAIVisionMock(...args),
}));

const { default: appAuditRouter } = await import("./appAudit.js");

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  app.use("/api/app-audit", appAuditRouter);
  return app;
}

const IMAGE_DATA_URL = "data:image/png;base64,abc123";

describe("POST /api/app-audit/analyze", () => {
  beforeEach(() => {
    buildAppAuditPromptMock.mockClear();
    callOpenAIVisionMock.mockReset();
  });

  it("returns 400 when no image is provided", async () => {
    const res = await request(buildApp()).post("/api/app-audit/analyze").send({ screenLabel: "Dashboard" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when the payload isn't an image data URL", async () => {
    const res = await request(buildApp())
      .post("/api/app-audit/analyze")
      .send({ imageDataUrl: "not-an-image", screenLabel: "Dashboard" });
    expect(res.status).toBe(400);
  });

  it("builds the prompt with the label and context, and returns an AnalysisResult-shaped payload", async () => {
    buildAppAuditPromptMock.mockReturnValue("built-prompt");
    callOpenAIVisionMock.mockResolvedValue({
      conversionScore: 62,
      grade: "Needs Optimization",
      topIssues: ["Empty state doesn't guide the user"],
      frictionPoints: [
        {
          category: "onboarding-friction",
          severity: "high",
          title: "Empty dashboard gives no next step",
          description: "New users land on a blank dashboard with no call to action.",
          location: "main content area",
          fix: "Add a guided empty state with a primary CTA to create the first project.",
          impactScore: 85,
          roiEstimate: "Could meaningfully lift activation rate",
        },
      ],
    });

    const res = await request(buildApp())
      .post("/api/app-audit/analyze")
      .send({ imageDataUrl: IMAGE_DATA_URL, screenLabel: "Dashboard", context: "Let a user create their first project" });

    expect(res.status).toBe(200);
    expect(buildAppAuditPromptMock).toHaveBeenCalledWith("Dashboard", "Let a user create their first project");
    expect(callOpenAIVisionMock).toHaveBeenCalledWith("built-prompt", IMAGE_DATA_URL);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.url).toBe("Dashboard");
    expect(data.analysisType).toBe("app-screen");
    expect(data.conversionScore).toBe(62);
    expect(data.grade).toBe("Needs Optimization");
    expect(data.topIssues).toEqual(["Empty state doesn't guide the user"]);
    expect(data.screenshotUrl).toBe(IMAGE_DATA_URL);

    expect(data.frictionPoints).toHaveLength(1);
    const fp = data.frictionPoints[0];
    expect(fp.id).toBe("fp-1");
    expect(fp.category).toBe("onboarding-friction");
    expect(fp.severity).toBe("high");
    expect(fp.selector).toBe("main content area");
    expect(fp.impactScore).toBe(85);
    expect(fp.screenshotUrl).toBe(IMAGE_DATA_URL);
    expect(fp.benchmark).toEqual({ industryAvg: 50, topPerformers: 80, label: "Score" });
  });

  it("falls back to a placeholder label when none is given", async () => {
    callOpenAIVisionMock.mockResolvedValue({ conversionScore: 50, frictionPoints: [] });

    const res = await request(buildApp())
      .post("/api/app-audit/analyze")
      .send({ imageDataUrl: IMAGE_DATA_URL });

    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe("In-app screen");
  });

  it("returns 500 with a clear error when the AI call fails", async () => {
    callOpenAIVisionMock.mockRejectedValue(new Error("AI unavailable"));

    const res = await request(buildApp())
      .post("/api/app-audit/analyze")
      .send({ imageDataUrl: IMAGE_DATA_URL, screenLabel: "Dashboard" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "AI unavailable" });
  });
});
