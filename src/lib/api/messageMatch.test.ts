import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkMessageMatch } from "./messageMatch";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("checkMessageMatch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the message-match check route and returns the result data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { matchScore: 85, verdict: "Strong Match" } }),
    });

    const result = await checkMessageMatch("https://example.com", "Get 50% off");

    expect(result).toEqual({ matchScore: 85, verdict: "Strong Match" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/message-match/check",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com", sourceMessage: "Get 50% off" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "Scrape failed" }) });
    await expect(checkMessageMatch("https://example.com", "Get 50% off")).rejects.toThrow("Scrape failed");
  });

  it("throws when success is false even with a 200 status", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false, error: "Source message is required" }) });
    await expect(checkMessageMatch("https://example.com", "")).rejects.toThrow("Source message is required");
  });
});
