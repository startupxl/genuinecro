import type { CategoryScore } from "./mockData";

export interface CategoryComparisonRow {
  category: string;
  yourScore: number;
  competitorScore: number;
  delta: number;
}

export function buildCategoryComparison(
  yourScores: Partial<Record<string, CategoryScore>>,
  competitorScores: Partial<Record<string, CategoryScore>>
): CategoryComparisonRow[] {
  const categories = new Set([...Object.keys(yourScores), ...Object.keys(competitorScores)]);
  return [...categories].map((category) => {
    const yourScore = yourScores[category]?.score ?? 0;
    const competitorScore = competitorScores[category]?.score ?? 0;
    return { category, yourScore, competitorScore, delta: yourScore - competitorScore };
  });
}

export interface GapSummary {
  ahead: CategoryComparisonRow[];
  behind: CategoryComparisonRow[];
}

export function summarizeGaps(rows: CategoryComparisonRow[], threshold = 5): GapSummary {
  const ahead = rows.filter((r) => r.delta >= threshold).sort((a, b) => b.delta - a.delta);
  const behind = rows.filter((r) => r.delta <= -threshold).sort((a, b) => a.delta - b.delta);
  return { ahead, behind };
}
