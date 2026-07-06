import { describe, it, expect } from "vitest";
import { buildVariantCopyPrompt } from "./variantCopyPrompt.js";

describe("buildVariantCopyPrompt", () => {
  const point = {
    category: "cta-effectiveness",
    title: "Multiple competing CTAs",
    description: "The hero area offers several actions of similar visual weight.",
    fix: "Prominently present one primary CTA with highest contrast and size.",
  };

  it("includes the friction point's title, description, and fix", () => {
    const prompt = buildVariantCopyPrompt(point);
    expect(prompt).toContain("Multiple competing CTAs");
    expect(prompt).toContain("The hero area offers several actions of similar visual weight.");
    expect(prompt).toContain("Prominently present one primary CTA with highest contrast and size.");
  });

  it("requires the JSON schema fields in the instructions", () => {
    const prompt = buildVariantCopyPrompt(point);
    expect(prompt).toContain("variants");
    expect(prompt).toContain("label");
    expect(prompt).toContain("copy");
    expect(prompt).toContain("rationale");
  });

  it("instructs the model to produce ready-to-use copy, not descriptions", () => {
    const prompt = buildVariantCopyPrompt(point);
    expect(prompt).toContain("ready-to-test");
  });
});
