import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTestBrief } from "./testBrief";

describe("generateTestBrief", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("posts to /api/test-brief/generate and returns the parsed data on success", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          problemStatement: "Multiple CTAs compete for attention.",
          hypothesis: "A single CTA will outperform three.",
          successMetric: "Signup conversion rate",
          secondaryMetrics: ["Bounce rate"],
          variants: [
            { name: "Control", description: "Three CTAs" },
            { name: "Variant A", description: "One primary CTA" },
          ],
          audienceAndSplit: "All visitors, 50/50 split",
          estimatedDuration: "3 weeks",
          risks: ["Seasonal dip"],
        },
      }),
    });

    const result = await generateTestBrief({
      hypothesis: "A single CTA will outperform three.",
      page: "startupxl.com/pricing",
      goal: "Signups",
      context: "5,000 visitors/week",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test-brief/generate",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.successMetric).toBe("Signup conversion rate");
    expect(result.variants).toHaveLength(2);
  });

  it("throws with the server's error message on failure", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "AI unavailable" }),
    });

    await expect(
      generateTestBrief({ hypothesis: "h", page: "p", goal: "g", context: "" })
    ).rejects.toThrow("AI unavailable");
  });
});
