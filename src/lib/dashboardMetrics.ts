import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem } from "./firebase/actionItems";
import { categoryLabels } from "./mockData";

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export function buildScoreTrendData(analyses: AnalysisRecord[], domain: string | null): ScoreTrendPoint[] {
  return analyses
    .filter((a) => a.analysisType !== "technical")
    .filter((a) => !domain || getDomain(a.url) === domain)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((a) => ({ date: a.createdAt, score: a.conversionScore }));
}

export interface CategoryBreakdownEntry {
  category: string;
  label: string;
  count: number;
}

export function buildCategoryBreakdown(items: ActionItem[], domain: string | null): CategoryBreakdownEntry[] {
  const filtered = items.filter((i) => !domain || getDomain(i.url) === domain);

  const counts = new Map<string, number>();
  for (const item of filtered) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, label: categoryLabels[category] ?? category, count }))
    .sort((a, b) => b.count - a.count);
}
