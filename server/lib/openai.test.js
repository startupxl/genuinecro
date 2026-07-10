import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env.OPENAI_API_KEY = "test-openai-key";

const { callOpenAI, callOpenAIVision } = await import("./openai.js");

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

describe("callOpenAIVision", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("sends the prompt and image as a multimodal message and returns the parsed JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"conversionScore": 65}' } }] }),
    });

    const result = await callOpenAIVision("describe this screenshot", "data:image/png;base64,abc123");

    expect(result).toEqual({ conversionScore: 65 });
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "describe this screenshot" },
      { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } },
    ]);
  });

  it("strips markdown code fences before parsing, same as callOpenAI", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"conversionScore": 40}\n```' } }] }),
    });

    const result = await callOpenAIVision("prompt", "data:image/png;base64,abc123");
    expect(result).toEqual({ conversionScore: 40 });
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });
    await expect(callOpenAIVision("prompt", "data:image/png;base64,abc123")).rejects.toThrow();
  });
});
