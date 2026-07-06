import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateVariantCopy } from "./variantCopy";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("generateVariantCopy", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts the friction point details and returns the generated variants", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { variants: [{ label: "Variant A", copy: "Get Started", rationale: "r" }] } }),
    });

    const result = await generateVariantCopy({
      category: "cta-effectiveness",
      title: "Multiple competing CTAs",
      description: "d",
      fix: "f",
    });

    expect(result.variants).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variant-copy/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ category: "cta-effectiveness", title: "Multiple competing CTAs", description: "d", fix: "f" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "AI unavailable" }) });
    await expect(
      generateVariantCopy({ category: "c", title: "t", description: "d", fix: "f" })
    ).rejects.toThrow("AI unavailable");
  });
});
