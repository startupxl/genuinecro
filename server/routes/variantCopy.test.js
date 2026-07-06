import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildVariantCopyPromptMock = vi.fn(() => "built-prompt");
const callOpenAIMock = vi.fn();

vi.mock("../lib/variantCopyPrompt.js", () => ({
  buildVariantCopyPrompt: (...args) => buildVariantCopyPromptMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const { default: variantCopyRouter } = await import("./variantCopy.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/variant-copy", variantCopyRouter);
  return app;
}

const validBody = {
  category: "cta-effectiveness",
  title: "Multiple competing CTAs",
  description: "The hero area offers several actions of similar visual weight.",
  fix: "Prominently present one primary CTA.",
};

describe("POST /api/variant-copy/generate", () => {
  beforeEach(() => {
    buildVariantCopyPromptMock.mockClear();
    callOpenAIMock.mockReset();
  });

  it("returns 400 when the fix is missing", () => {
    return request(buildApp())
      .post("/api/variant-copy/generate")
      .send({ category: "cta-effectiveness", title: "t", description: "d" })
      .then((res) => {
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ success: false, error: "Friction point details are required" });
      });
  });

  it("returns the generated variants on the happy path", async () => {
    callOpenAIMock.mockResolvedValue({
      variants: [
        { label: "Variant A", copy: "Get Started Free", rationale: "Lowers perceived risk" },
        { label: "Variant B", copy: "Start Your Trial", rationale: "Implies limited-time action" },
        { label: "Variant C", copy: "Join 10,000+ Teams", rationale: "Social proof" },
      ],
    });

    const res = await request(buildApp()).post("/api/variant-copy/generate").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.variants).toHaveLength(3);
    expect(res.body.data.variants[0].copy).toBe("Get Started Free");
    expect(buildVariantCopyPromptMock).toHaveBeenCalledWith(validBody);
  });

  it("returns 500 with a clear error when the AI call fails", async () => {
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));

    const res = await request(buildApp()).post("/api/variant-copy/generate").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "AI unavailable" });
  });
});
