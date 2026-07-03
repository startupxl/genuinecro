import { describe, it, expect } from "vitest";
import { CRITERIA_LIBRARY } from "./criteriaLibrary.js";
import { SCORING_CATEGORIES } from "./analysisPrompt.js";

const VALID_CATEGORIES = Object.keys(SCORING_CATEGORIES);

describe("CRITERIA_LIBRARY", () => {
  it("has ten criteria each for homepage and checkout", () => {
    expect(CRITERIA_LIBRARY.homepage).toHaveLength(10);
    expect(CRITERIA_LIBRARY.checkout).toHaveLength(10);
  });

  it("gives every criterion an id, a valid category, a rule, guidance, and a source", () => {
    for (const pageType of ["homepage", "checkout"]) {
      for (const criterion of CRITERIA_LIBRARY[pageType]) {
        expect(typeof criterion.id).toBe("string");
        expect(criterion.id.length).toBeGreaterThan(0);
        expect(VALID_CATEGORIES).toContain(criterion.category);
        expect(typeof criterion.rule).toBe("string");
        expect(criterion.rule.length).toBeGreaterThan(0);
        expect(typeof criterion.guidance).toBe("string");
        expect(criterion.guidance.length).toBeGreaterThan(0);
        expect(typeof criterion.source).toBe("string");
        expect(criterion.source.length).toBeGreaterThan(0);
      }
    }
  });

  it("has unique ids across both page types", () => {
    const allIds = [...CRITERIA_LIBRARY.homepage, ...CRITERIA_LIBRARY.checkout].map((c) => c.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
