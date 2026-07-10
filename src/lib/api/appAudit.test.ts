import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeAppScreen } from "./appAudit";

const input = { imageDataUrl: "data:image/png;base64,abc123", screenLabel: "Dashboard", context: "First-time user" };

describe("analyzeAppScreen", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("posts the screenshot and returns the parsed AnalysisResult", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { url: "Dashboard", conversionScore: 62, frictionPoints: [] },
      }),
    });

    const result = await analyzeAppScreen(input);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/app-audit/analyze",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) })
    );
    expect(result.conversionScore).toBe(62);
  });

  it("throws with the server's error message on failure", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "A screenshot image is required" }),
    });

    await expect(analyzeAppScreen(input)).rejects.toThrow("A screenshot image is required");
  });
});
