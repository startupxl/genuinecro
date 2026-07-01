import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env.OPENAI_API_KEY = "test-openai-key";

const { callOpenAI } = await import("./openai.js");

describe("callOpenAI", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns the parsed JSON from a successful response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"conversionScore": 70}' } }] }),
    });

    const result = await callOpenAI("some prompt");

    expect(result).toEqual({ conversionScore: 70 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-openai-key" }),
      })
    );
  });

  it("strips markdown code fences before parsing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"conversionScore": 55}\n```' } }] }),
    });

    const result = await callOpenAI("some prompt");
    expect(result).toEqual({ conversionScore: 55 });
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });
    await expect(callOpenAI("some prompt")).rejects.toThrow();
  });

  it("throws when there is no content in the response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    await expect(callOpenAI("some prompt")).rejects.toThrow("No response from AI model");
  });

  it("throws when the content isn't valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
    });
    await expect(callOpenAI("some prompt")).rejects.toThrow("Failed to parse AI analysis results");
  });
});
