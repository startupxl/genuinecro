import type { AnalysisType } from "./mockData";

export type ConversionGoalType =
  | "purchase"
  | "subscription"
  | "demo_request"
  | "trial_signup"
  | "lead_form"
  | "newsletter_signup"
  | "content_download"
  | "webinar_registration"
  | "custom";

export interface ConversionGoal {
  type: ConversionGoalType;
  customLabel?: string;
  isMacro: boolean;
}

export interface ConversionGoalOption {
  type: ConversionGoalType;
  label: string;
  isMacro: boolean;
}

export const CONVERSION_GOAL_OPTIONS: ConversionGoalOption[] = [
  { type: "purchase", label: "Purchase / Transaction", isMacro: true },
  { type: "subscription", label: "Subscription / Signup", isMacro: true },
  { type: "demo_request", label: "Demo Request", isMacro: true },
  { type: "trial_signup", label: "Trial Signup", isMacro: false },
  { type: "lead_form", label: "Lead Form Submission", isMacro: false },
  { type: "newsletter_signup", label: "Newsletter Signup", isMacro: false },
  { type: "content_download", label: "Content Download", isMacro: false },
  { type: "webinar_registration", label: "Webinar Registration", isMacro: false },
  { type: "custom", label: "Custom goal…", isMacro: false },
];

export const GOAL_LABELS: Record<ConversionGoalType, string> = Object.fromEntries(
  CONVERSION_GOAL_OPTIONS.map((o) => [o.type, o.label])
) as Record<ConversionGoalType, string>;

/** Mirrors server/lib/analysisPrompt.js's SCORING_CATEGORIES weights — the generic, un-goal-weighted baseline. */
export const DEFAULT_CATEGORY_WEIGHTS: Record<string, number> = {
  "content-hierarchy": 0.10,
  navigation: 0.10,
  performance: 0.12,
  accessibility: 0.08,
  "visual-friction": 0.08,
  "ux-friction": 0.12,
  "trust-credibility": 0.15,
  "form-friction": 0.10,
  "cta-effectiveness": 0.10,
  "checkout-friction": 0.05,
};

/** Per-goal category weight tables, each summing to 1. Deviates from DEFAULT_CATEGORY_WEIGHTS to emphasize the categories that most affect that conversion goal. */
export const GOAL_CATEGORY_WEIGHTS: Record<Exclude<ConversionGoalType, "custom">, Record<string, number>> = {
  purchase: {
    "content-hierarchy": 0.06, navigation: 0.06, performance: 0.10, accessibility: 0.05,
    "visual-friction": 0.06, "ux-friction": 0.10, "trust-credibility": 0.18, "form-friction": 0.06,
    "cta-effectiveness": 0.13, "checkout-friction": 0.20,
  },
  subscription: {
    "content-hierarchy": 0.09, navigation: 0.07, performance: 0.10, accessibility: 0.06,
    "visual-friction": 0.06, "ux-friction": 0.10, "trust-credibility": 0.17, "form-friction": 0.14,
    "cta-effectiveness": 0.15, "checkout-friction": 0.06,
  },
  demo_request: {
    "content-hierarchy": 0.09, navigation: 0.07, performance: 0.08, accessibility: 0.05,
    "visual-friction": 0.05, "ux-friction": 0.09, "trust-credibility": 0.18, "form-friction": 0.17,
    "cta-effectiveness": 0.17, "checkout-friction": 0.05,
  },
  trial_signup: {
    "content-hierarchy": 0.10, navigation: 0.08, performance: 0.09, accessibility: 0.06,
    "visual-friction": 0.06, "ux-friction": 0.10, "trust-credibility": 0.12, "form-friction": 0.16,
    "cta-effectiveness": 0.18, "checkout-friction": 0.05,
  },
  lead_form: {
    "content-hierarchy": 0.08, navigation: 0.07, performance: 0.08, accessibility: 0.05,
    "visual-friction": 0.05, "ux-friction": 0.09, "trust-credibility": 0.19, "form-friction": 0.20,
    "cta-effectiveness": 0.14, "checkout-friction": 0.05,
  },
  newsletter_signup: {
    "content-hierarchy": 0.12, navigation: 0.08, performance: 0.10, accessibility: 0.06,
    "visual-friction": 0.07, "ux-friction": 0.11, "trust-credibility": 0.09, "form-friction": 0.15,
    "cta-effectiveness": 0.16, "checkout-friction": 0.06,
  },
  content_download: {
    "content-hierarchy": 0.17, navigation: 0.08, performance: 0.09, accessibility: 0.06,
    "visual-friction": 0.06, "ux-friction": 0.10, "trust-credibility": 0.08, "form-friction": 0.13,
    "cta-effectiveness": 0.17, "checkout-friction": 0.06,
  },
  webinar_registration: {
    "content-hierarchy": 0.13, navigation: 0.07, performance: 0.08, accessibility: 0.05,
    "visual-friction": 0.06, "ux-friction": 0.09, "trust-credibility": 0.14, "form-friction": 0.16,
    "cta-effectiveness": 0.17, "checkout-friction": 0.05,
  },
};

/**
 * Recomputes an overall score from per-category scores using the given goal's
 * category weight table (or the generic default when no goal, or a custom
 * goal with no predefined weights, is given). Renormalizes over whichever
 * categories are actually present, so partial category data still works.
 */
export function computeGoalWeightedScore(
  categoryScores: Record<string, number>,
  goal: ConversionGoal | null | undefined
): number {
  const weights =
    goal && goal.type !== "custom" ? GOAL_CATEGORY_WEIGHTS[goal.type] : DEFAULT_CATEGORY_WEIGHTS;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [category, weight] of Object.entries(weights)) {
    const score = categoryScores[category];
    if (score === undefined) continue;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/** A reasonable, editable starting point for the goal selector — there's no way to auto-detect intent from a URL the way page type can be, so this maps the (auto-detected or chosen) page type to the most common goal for that kind of page. */
const DEFAULT_GOAL_TYPE_FOR_PAGE_TYPE: Record<AnalysisType, ConversionGoalType> = {
  homepage: "subscription",
  "blog-content": "content_download",
  checkout: "purchase",
  "lead-form": "lead_form",
  "product-page": "purchase",
  "landing-marketing": "demo_request",
  "landing-paid-media": "lead_form",
  "app-screen": "custom",
};

export function getDefaultGoalForPageType(pageType: AnalysisType): ConversionGoal {
  const type = DEFAULT_GOAL_TYPE_FOR_PAGE_TYPE[pageType];
  const option = CONVERSION_GOAL_OPTIONS.find((o) => o.type === type)!;
  return { type, isMacro: option.isMacro };
}
