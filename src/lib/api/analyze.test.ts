import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeUrl } from "./analyze";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("analyzeUrl", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the analyze-url route and returns the result data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { conversionScore: 65 } }),
    });

    const result = await analyzeUrl("https://example.com", "homepage", "desktop");

    expect(result).toEqual({ conversionScore: 65 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze/analyze-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com", analysisType: "homepage", device: "desktop" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "Scrape failed" }) });
    await expect(analyzeUrl("https://example.com", "homepage", "desktop")).rejects.toThrow("Scrape failed");
  });

  it("throws when success is false even with a 200 status", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false, error: "No content extracted" }) });
    await expect(analyzeUrl("https://example.com", "homepage", "desktop")).rejects.toThrow("No content extracted");
  });
});
