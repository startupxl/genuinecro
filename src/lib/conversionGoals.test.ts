import { describe, it, expect } from "vitest";
import {
  CONVERSION_GOAL_OPTIONS,
  GOAL_CATEGORY_WEIGHTS,
  DEFAULT_CATEGORY_WEIGHTS,
  computeGoalWeightedScore,
  getDefaultGoalForPageType,
  type ConversionGoalType,
} from "./conversionGoals";

const NON_CUSTOM_GOALS = CONVERSION_GOAL_OPTIONS.map((o) => o.type).filter(
  (t): t is Exclude<ConversionGoalType, "custom"> => t !== "custom"
);

describe("CONVERSION_GOAL_OPTIONS", () => {
  it("includes the 3 macro and 5 micro goals from the spec, plus custom", () => {
    const macro = CONVERSION_GOAL_OPTIONS.filter((o) => o.isMacro).map((o) => o.type);
    const micro = CONVERSION_GOAL_OPTIONS.filter((o) => !o.isMacro && o.type !== "custom").map((o) => o.type);

    expect(macro.sort()).toEqual(["demo_request", "purchase", "subscription"].sort());
    expect(micro.sort()).toEqual(
      ["content_download", "lead_form", "newsletter_signup", "trial_signup", "webinar_registration"].sort()
    );
    expect(CONVERSION_GOAL_OPTIONS.map((o) => o.type)).toContain("custom");
  });
});

describe("DEFAULT_CATEGORY_WEIGHTS", () => {
  it("sums to 1 and matches the server's generic SCORING_CATEGORIES weights", () => {
    const total = Object.values(DEFAULT_CATEGORY_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
    expect(DEFAULT_CATEGORY_WEIGHTS["trust-credibility"]).toBe(0.15);
    expect(DEFAULT_CATEGORY_WEIGHTS["checkout-friction"]).toBe(0.05);
  });
});

describe("GOAL_CATEGORY_WEIGHTS", () => {
  it("defines a weight table for every non-custom goal, each summing to 1", () => {
    for (const goal of NON_CUSTOM_GOALS) {
      const table = GOAL_CATEGORY_WEIGHTS[goal];
      expect(table).toBeDefined();
      const total = Object.values(table).reduce((s, w) => s + w, 0);
      expect(Math.round(total * 100) / 100).toBe(1);
    }
  });

  it("weights Form Friction and Trust & Credibility higher for lead_form than for content_download (per spec example)", () => {
    expect(GOAL_CATEGORY_WEIGHTS.lead_form["form-friction"]).toBeGreaterThan(
      GOAL_CATEGORY_WEIGHTS.content_download["form-friction"]
    );
    expect(GOAL_CATEGORY_WEIGHTS.lead_form["trust-credibility"]).toBeGreaterThan(
      GOAL_CATEGORY_WEIGHTS.content_download["trust-credibility"]
    );
  });

  it("weights Content Hierarchy higher for content_download than for lead_form (per spec example)", () => {
    expect(GOAL_CATEGORY_WEIGHTS.content_download["content-hierarchy"]).toBeGreaterThan(
      GOAL_CATEGORY_WEIGHTS.lead_form["content-hierarchy"]
    );
  });

  it("weights Checkout Friction highest for purchase among all goals", () => {
    const purchaseCheckout = GOAL_CATEGORY_WEIGHTS.purchase["checkout-friction"];
    for (const goal of NON_CUSTOM_GOALS) {
      if (goal === "purchase") continue;
      expect(purchaseCheckout).toBeGreaterThanOrEqual(GOAL_CATEGORY_WEIGHTS[goal]["checkout-friction"]);
    }
  });
});

describe("computeGoalWeightedScore", () => {
  const evenCategoryScores: Record<string, number> = {
    "content-hierarchy": 50, navigation: 50, performance: 50, accessibility: 50,
    "visual-friction": 50, "ux-friction": 50, "trust-credibility": 50, "form-friction": 50,
    "cta-effectiveness": 50, "checkout-friction": 50,
  };

  it("returns the flat score when every category scores the same, regardless of goal", () => {
    expect(computeGoalWeightedScore(evenCategoryScores, { type: "purchase", isMacro: true })).toBe(50);
    expect(computeGoalWeightedScore(evenCategoryScores, { type: "lead_form", isMacro: false })).toBe(50);
  });

  it("uses the default (unweighted) table when no goal is provided", () => {
    const scores = { ...evenCategoryScores, "checkout-friction": 100 };
    const defaultResult = computeGoalWeightedScore(scores, null);
    const purchaseResult = computeGoalWeightedScore(scores, { type: "purchase", isMacro: true });
    // Purchase weights checkout-friction higher than the default table, so boosting
    // checkout-friction should raise the purchase-weighted score above the default.
    expect(purchaseResult).toBeGreaterThan(defaultResult);
  });

  it("uses the default table for a custom goal (no predefined weights)", () => {
    const scores = { ...evenCategoryScores, "checkout-friction": 100 };
    const defaultResult = computeGoalWeightedScore(scores, null);
    const customResult = computeGoalWeightedScore(scores, { type: "custom", customLabel: "Something else", isMacro: false });
    expect(customResult).toBe(defaultResult);
  });

  it("raises the score when a heavily-weighted category for that goal scores well", () => {
    const highTrust = { ...evenCategoryScores, "trust-credibility": 100, "form-friction": 100 };
    const leadFormScore = computeGoalWeightedScore(highTrust, { type: "lead_form", isMacro: false });
    const defaultScore = computeGoalWeightedScore(highTrust, null);
    expect(leadFormScore).toBeGreaterThan(defaultScore);
  });

  it("renormalizes over whatever categories are actually present", () => {
    const partial = { "trust-credibility": 80, "form-friction": 40 };
    const result = computeGoalWeightedScore(partial, { type: "lead_form", isMacro: false });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("returns 0 when there are no category scores at all", () => {
    expect(computeGoalWeightedScore({}, { type: "purchase", isMacro: true })).toBe(0);
  });
});

describe("getDefaultGoalForPageType", () => {
  it("suggests a sensible, always-macro-or-micro-tagged default goal for every page type", () => {
    expect(getDefaultGoalForPageType("checkout")).toEqual({ type: "purchase", isMacro: true });
    expect(getDefaultGoalForPageType("lead-form")).toEqual({ type: "lead_form", isMacro: false });
  });

  it("returns a goal for every AnalysisType with a valid, defined isMacro flag", () => {
    const pageTypes: Parameters<typeof getDefaultGoalForPageType>[0][] = [
      "homepage", "blog-content", "checkout", "lead-form", "product-page", "landing-marketing", "landing-paid-media",
    ];
    for (const pageType of pageTypes) {
      const goal = getDefaultGoalForPageType(pageType);
      expect(goal.type).toBeTruthy();
      expect(typeof goal.isMacro).toBe("boolean");
    }
  });
});
