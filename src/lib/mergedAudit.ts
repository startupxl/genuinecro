import { analyzeUrl } from "./api/analyze";
import { runTechnicalAudit } from "./api/technical";
import { extractCategoryScores, type AnalysisType, type AnalysisResult } from "./mockData";
import type { FrictionPointInput } from "./firebase/actionItems";
import { computeGoalWeightedScore, type ConversionGoal } from "./conversionGoals";

const TECHNICAL_WEIGHT = 0.15;
const CONVERSION_WEIGHT = 0.85;

export const CATEGORY_TAB: Record<string, string> = {
  "technical-seo": "Technical",
  "content-hierarchy": "Content",
  navigation: "Navigation",
  performance: "Performance",
  accessibility: "Accessibility",
  "visual-friction": "Conversion",
  "ux-friction": "Conversion",
  "trust-credibility": "Trust & Credibility",
  "form-friction": "Conversion",
  "cta-effectiveness": "Conversion",
  "checkout-friction": "Conversion",
};

export function getCategoryTab(category: string): string {
  return CATEGORY_TAB[category] ?? "Conversion";
}

export function combineScores(technicalScore: number | null, conversionScore: number): number {
  if (technicalScore === null) return conversionScore;
  return Math.round(technicalScore * TECHNICAL_WEIGHT + conversionScore * CONVERSION_WEIGHT);
}

export interface MergedAuditResult {
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  technicalScore: number | null;
  benchmark: AnalysisResult["benchmark"];
  frictionPoints: FrictionPointInput[];
  conversionGoal: ConversionGoal | null;
}

export async function runMergedAudit(
  url: string,
  type: AnalysisType,
  device: "desktop" | "mobile",
  goal: ConversionGoal | null = null
): Promise<MergedAuditResult> {
  const conversionResult = await analyzeUrl(url, type, device);

  const categoryScores = extractCategoryScores(conversionResult.benchmark);
  const rawConversionScore = conversionResult.conversionScore ?? conversionResult.benchmark.overallScore;
  const conversionScore = Object.keys(categoryScores).length > 0
    ? computeGoalWeightedScore(categoryScores, goal)
    : rawConversionScore;

  let technicalScore: number | null = null;
  let technicalIssues: FrictionPointInput[] = [];
  try {
    const technicalResult = await runTechnicalAudit(url);
    technicalScore = technicalResult.technicalScore;
    technicalIssues = technicalResult.issues;
  } catch (err) {
    console.error("Technical audit failed, using conversion score alone:", err);
  }

  return {
    url,
    analysisType: type,
    device,
    conversionScore: combineScores(technicalScore, conversionScore),
    technicalScore,
    benchmark: conversionResult.benchmark,
    frictionPoints: [...conversionResult.frictionPoints, ...technicalIssues],
    conversionGoal: goal,
  };
}
