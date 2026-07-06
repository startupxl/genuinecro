import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildAnalysisPromptMock = vi.fn(() => "built-prompt");
const generateHeuristicAnalysisMock = vi.fn();
const callOpenAIMock = vi.fn();
const recordCategoryScoresMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/analysisPrompt.js", () => ({
  buildAnalysisPrompt: (...args) => buildAnalysisPromptMock(...args),
}));
vi.mock("../lib/heuristicAnalysis.js", () => ({
  generateHeuristicAnalysis: (...args) => generateHeuristicAnalysisMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));
vi.mock("../lib/benchmarks.js", () => ({
  recordCategoryScores: (...args) => recordCategoryScoresMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: analyzeRouter } = await import("./analyze.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/analyze", analyzeRouter);
  return app;
}

describe("POST /api/analyze/analyze-url", () => {
  beforeEach(() => {
    buildAnalysisPromptMock.mockClear();
    generateHeuristicAnalysisMock.mockReset();
    callOpenAIMock.mockReset();
    recordCategoryScoresMock.mockClear();
    fetchMock.mockReset();
    process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
  });

  it("returns 400 when the URL is missing", async () => {
    const res = await request(buildApp()).post("/api/analyze/analyze-url").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "URL is required" });
  });

  it("returns the scrape error when Firecrawl fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Scrape blocked" }) });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ success: false, error: "Scrape blocked" });
  });

  it("returns AI-analyzed results on the happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Test issue", impactScore: 80 }],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversionScore).toBe(72);
    expect(res.body.data.frictionPoints[0].screenshotUrl).toBe("https://shot.example/a.png");
    expect(generateHeuristicAnalysisMock).not.toHaveBeenCalled();
  });

  it("passes through a sourceCitation when the AI includes one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [
        {
          category: "friction-effort",
          severity: "high",
          title: "Forced account creation",
          impactScore: 90,
          sourceCitation: "Baymard Institute's publicly published checkout usability research",
        },
      ],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "checkout", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.data.frictionPoints[0].sourceCitation).toBe(
      "Baymard Institute's publicly published checkout usability research"
    );
  });

  it("defaults sourceCitation to null when the AI omits one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Test issue", impactScore: 80 }],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.data.frictionPoints[0].sourceCitation).toBeNull();
  });

  it("passes the siteType through to buildAnalysisPrompt when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72, grade: "Strong", topIssues: [], insightSummary: {}, categoryScores: {}, frictionPoints: [],
    });

    await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop", siteType: "ecommerce" });

    expect(buildAnalysisPromptMock).toHaveBeenCalledWith("homepage", "# Page content", "https://example.com", "desktop", "ecommerce");
  });

  it("passes through effort and confidence when the AI includes them", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [
        { category: "ux-clarity", severity: "high", title: "Test issue", impactScore: 80, effort: "low", confidence: "high" },
      ],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.data.frictionPoints[0].effort).toBe("low");
    expect(res.body.data.frictionPoints[0].confidence).toBe("high");
  });

  it("falls back to the heuristic analysis when the AI call fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));
    generateHeuristicAnalysisMock.mockReturnValue({ conversionScore: 40, frictionPoints: [] });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { conversionScore: 40, frictionPoints: [] } });
  });

  it("records category scores for cross-account benchmarks on the AI happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: { navigation: 65, performance: 70 },
      frictionPoints: [{ category: "navigation", severity: "high", title: "Test issue", impactScore: 80 }],
    });

    await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });
    await new Promise((r) => setImmediate(r));

    expect(recordCategoryScoresMock).toHaveBeenCalledWith({ navigation: 65, performance: 70 });
  });

  it("does not record benchmark samples on the heuristic fallback path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));
    generateHeuristicAnalysisMock.mockReturnValue({ conversionScore: 40, frictionPoints: [] });

    await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });
    await new Promise((r) => setImmediate(r));

    expect(recordCategoryScoresMock).not.toHaveBeenCalled();
  });
});
