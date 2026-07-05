import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildMessageMatchPromptMock = vi.fn(() => "built-prompt");
const generateHeuristicMessageMatchMock = vi.fn();
const callOpenAIMock = vi.fn();

vi.mock("../lib/messageMatchPrompt.js", () => ({
  buildMessageMatchPrompt: (...args) => buildMessageMatchPromptMock(...args),
}));
vi.mock("../lib/heuristicMessageMatch.js", () => ({
  generateHeuristicMessageMatch: (...args) => generateHeuristicMessageMatchMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: messageMatchRouter } = await import("./messageMatch.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/message-match", messageMatchRouter);
  return app;
}

describe("POST /api/message-match/check", () => {
  beforeEach(() => {
    buildMessageMatchPromptMock.mockClear();
    generateHeuristicMessageMatchMock.mockReset();
    callOpenAIMock.mockReset();
    fetchMock.mockReset();
    process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
  });

  it("returns 400 when the URL is missing", async () => {
    const res = await request(buildApp()).post("/api/message-match/check").send({ sourceMessage: "Get 50% off" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "URL is required" });
  });

  it("returns 400 when the source message is missing", async () => {
    const res = await request(buildApp()).post("/api/message-match/check").send({ url: "example.com" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Source message is required" });
  });

  it("returns the scrape error when Firecrawl fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Scrape blocked" }) });

    const res = await request(buildApp())
      .post("/api/message-match/check")
      .send({ url: "example.com", sourceMessage: "Get 50% off" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ success: false, error: "Scrape blocked" });
  });

  it("returns AI-analyzed results on the happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# 50% Off Widgets" } }),
    });
    callOpenAIMock.mockResolvedValue({
      matchScore: 85,
      verdict: "Strong Match",
      pageHeadline: "50% Off Widgets",
      alignedElements: ["Headline matches the offer"],
      misalignedElements: [],
      recommendations: [],
    });

    const res = await request(buildApp())
      .post("/api/message-match/check")
      .send({ url: "example.com", sourceMessage: "Get 50% off widgets" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matchScore).toBe(85);
    expect(res.body.data.verdict).toBe("Strong Match");
    expect(res.body.data.url).toBe("https://example.com");
    expect(res.body.data.sourceMessage).toBe("Get 50% off widgets");
    expect(generateHeuristicMessageMatchMock).not.toHaveBeenCalled();
  });

  it("falls back to the heuristic checker when the AI call fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# 50% Off Widgets" } }),
    });
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));
    generateHeuristicMessageMatchMock.mockReturnValue({
      url: "https://example.com",
      sourceMessage: "Get 50% off widgets",
      matchScore: 60,
      verdict: "Partial Match",
      pageHeadline: "50% Off Widgets",
      alignedElements: [],
      misalignedElements: [],
      recommendations: [],
    });

    const res = await request(buildApp())
      .post("/api/message-match/check")
      .send({ url: "example.com", sourceMessage: "Get 50% off widgets" });

    expect(res.status).toBe(200);
    expect(res.body.data.matchScore).toBe(60);
  });
});
