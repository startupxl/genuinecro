import { describe, it, expect } from "vitest";
import { buildAppAuditPrompt } from "./appAuditPrompt.js";

describe("buildAppAuditPrompt", () => {
  it("includes the screen label when provided", () => {
    const prompt = buildAppAuditPrompt("Onboarding Step 2", "");
    expect(prompt).toContain("Onboarding Step 2");
  });

  it("omits a label mention when none is provided", () => {
    const prompt = buildAppAuditPrompt("", "");
    expect(prompt.toLowerCase()).not.toContain('— ""');
  });

  it("includes the user's context about what the screen should let them do, when provided", () => {
    const prompt = buildAppAuditPrompt("Dashboard", "Let a new user create their first project");
    expect(prompt).toContain("Let a new user create their first project");
  });

  it("covers the core in-app UX categories, not marketing-page criteria", () => {
    const prompt = buildAppAuditPrompt("", "");
    const lower = prompt.toLowerCase();
    expect(lower).toContain("onboarding");
    expect(lower).toContain("empty state");
    expect(lower).toContain("discoverab");
    expect(lower).toContain("navigation");
    expect(lower).toContain("upgrade");
    expect(lower).not.toContain("checkout");
    expect(lower).not.toContain("cart abandonment");
  });

  it("tells the model there's no DOM selector, only a visual location", () => {
    const prompt = buildAppAuditPrompt("", "");
    expect(prompt.toLowerCase()).toContain("location");
  });

  it("asks for a JSON response with conversionScore, grade, topIssues, and frictionPoints", () => {
    const prompt = buildAppAuditPrompt("", "");
    expect(prompt).toContain("\"conversionScore\"");
    expect(prompt).toContain("\"grade\"");
    expect(prompt).toContain("\"topIssues\"");
    expect(prompt).toContain("\"frictionPoints\"");
  });
});
