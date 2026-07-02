import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTechnicalAudit } from "./technical";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("runTechnicalAudit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the technical audit route and returns the result data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { url: "https://example.com", technicalScore: 80, checks: {}, issues: [] } }),
    });

    const result = await runTechnicalAudit("example.com");

    expect(result.technicalScore).toBe(80);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/technical/audit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "example.com" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "Could not fetch the page (404)" }) });
    await expect(runTechnicalAudit("example.com")).rejects.toThrow("Could not fetch the page (404)");
  });
});
