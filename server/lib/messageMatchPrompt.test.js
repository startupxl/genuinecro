import { describe, it, expect } from "vitest";
import { buildMessageMatchPrompt } from "./messageMatchPrompt.js";

describe("buildMessageMatchPrompt", () => {
  it("includes the source message, url, and page content", () => {
    const prompt = buildMessageMatchPrompt("Get 50% off your first order", "# Welcome\nShop now", "https://example.com");
    expect(prompt).toContain("Get 50% off your first order");
    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("Shop now");
  });

  it("truncates page content to 8000 characters", () => {
    const longMarkdown = "x".repeat(12000);
    const prompt = buildMessageMatchPrompt("Some ad copy", longMarkdown, "https://example.com");
    const contentSection = prompt.split("PAGE CONTENT:\n")[1];
    expect(contentSection.length).toBe(8000);
  });

  it("requires the JSON schema fields in the instructions", () => {
    const prompt = buildMessageMatchPrompt("Some ad copy", "content", "https://example.com");
    expect(prompt).toContain("matchScore");
    expect(prompt).toContain("verdict");
    expect(prompt).toContain("pageHeadline");
    expect(prompt).toContain("alignedElements");
    expect(prompt).toContain("misalignedElements");
    expect(prompt).toContain("recommendations");
  });

  it("constrains verdict to the three defined labels", () => {
    const prompt = buildMessageMatchPrompt("Some ad copy", "content", "https://example.com");
    expect(prompt).toContain("Strong Match");
    expect(prompt).toContain("Partial Match");
    expect(prompt).toContain("Mismatch");
  });
});
