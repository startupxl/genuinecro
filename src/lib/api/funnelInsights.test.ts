import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeFunnel } from "./funnelInsights";

const steps = [
  { label: "Landing", url: "https://example.com", score: 72, topIssues: ["Weak CTA"] },
  { label: "Checkout", url: "https://example.com/checkout", score: 55, topIssues: [] },
];

describe("analyzeFunnel", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("posts the steps to /api/funnel-insights/analyze and returns the parsed data", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          weakestStepIndex: 1,
          summary: "Checkout leaks the most buyers.",
          transitionIssues: ["Promise broken between Landing and Checkout"],
          recommendations: ["Cut form fields"],
        },
      }),
    });

    const result = await analyzeFunnel(steps);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/funnel-insights/analyze",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ steps }) })
    );
    expect(result.weakestStepIndex).toBe(1);
    expect(result.recommendations).toEqual(["Cut form fields"]);
  });

  it("throws with the server's error message on failure", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "AI unavailable" }),
    });

    await expect(analyzeFunnel(steps)).rejects.toThrow("AI unavailable");
  });
});
