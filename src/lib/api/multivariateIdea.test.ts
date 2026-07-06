import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandMultivariateIdea } from "./multivariateIdea";

describe("expandMultivariateIdea", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("posts to /api/multivariate-idea/expand and returns the parsed data on success", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          factors: [{ name: "CTA Color", levels: ["Control: teal", "Alternative: orange"] }],
          suggestedCombinations: [{ label: "Combination 1", description: "orange + new copy", rationale: "contrast" }],
          testingNote: "Consider a fractional design.",
        },
      }),
    });

    const result = await expandMultivariateIdea({
      baseIdea: "Make the CTA more prominent",
      pageContext: "Homepage hero",
      goal: "Signups",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/multivariate-idea/expand",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.factors).toHaveLength(1);
    expect(result.testingNote).toContain("fractional design");
  });

  it("throws with the server's error message on failure", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "AI unavailable" }),
    });

    await expect(
      expandMultivariateIdea({ baseIdea: "b", pageContext: "p", goal: "g" })
    ).rejects.toThrow("AI unavailable");
  });
});
