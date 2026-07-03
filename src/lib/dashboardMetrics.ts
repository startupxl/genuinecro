import type { AnalysisRecord, SiteSummary } from "./firebase/analyses";
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
  barColorClass?: string;
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

export type SeverityBand = "Critical" | "Needs Work" | "Good" | "Excellent";

export function getSeverityBand(score: number): SeverityBand {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Critical";
}

const severityLabels: Record<string, string> = { high: "Critical", med: "Warning", low: "Info" };
const severityBarColors: Record<string, string> = {
  high: "bg-friction-high",
  med: "bg-friction-med",
  low: "bg-friction-low",
};
const severityOrder = ["high", "med", "low"];

export function buildSeverityBreakdown(items: ActionItem[], domain: string | null): CategoryBreakdownEntry[] {
  const filtered = items.filter((i) => !domain || getDomain(i.url) === domain);

  const counts = new Map<string, number>();
  for (const item of filtered) {
    counts.set(item.severity, (counts.get(item.severity) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([severity, count]) => ({
      category: severity,
      label: severityLabels[severity] ?? severity,
      count,
      barColorClass: severityBarColors[severity],
    }))
    .sort((a, b) => severityOrder.indexOf(a.category) - severityOrder.indexOf(b.category));
}

export interface PageBreakdownEntry {
  url: string;
  domain: string;
  analysisType: string;
  score: number;
  issueCount: number;
  lastCrawled: string;
}

export function buildPageBreakdown(analyses: AnalysisRecord[], items: ActionItem[]): PageBreakdownEntry[] {
  const nonTechnical = analyses.filter((a) => a.analysisType !== "technical");

  const latestByUrl = new Map<string, AnalysisRecord>();
  for (const a of nonTechnical) {
    const existing = latestByUrl.get(a.url);
    if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByUrl.set(a.url, a);
    }
  }

  const openIssueCountByUrl = new Map<string, number>();
  for (const item of items) {
    if (item.status === "resolved") continue;
    openIssueCountByUrl.set(item.url, (openIssueCountByUrl.get(item.url) ?? 0) + 1);
  }

  return [...latestByUrl.values()]
    .map((a) => ({
      url: a.url,
      domain: getDomain(a.url),
      analysisType: a.analysisType,
      score: a.conversionScore,
      issueCount: openIssueCountByUrl.get(a.url) ?? 0,
      lastCrawled: a.createdAt,
    }))
    .sort((a, b) => new Date(b.lastCrawled).getTime() - new Date(a.lastCrawled).getTime());
}

export interface HeroScoreSummary {
  overallScore: number;
  trendDelta: number | null;
  band: SeverityBand;
  pagesAudited: number;
  lastAuditAt: string | null;
}

export function buildHeroScoreSummary(sites: SiteSummary[], analyses: AnalysisRecord[]): HeroScoreSummary {
  const nonTechnical = analyses.filter((a) => a.analysisType !== "technical");

  const overallScore = sites.length > 0
    ? Math.round(sites.reduce((sum, s) => sum + s.latestScore, 0) / sites.length)
    : 0;

  const sitesWithDelta = sites.filter((s): s is SiteSummary & { scoreDelta: number } => s.scoreDelta !== null);
  const trendDelta = sitesWithDelta.length > 0
    ? Math.round(sitesWithDelta.reduce((sum, s) => sum + s.scoreDelta, 0) / sitesWithDelta.length)
    : null;

  const lastAuditAt = nonTechnical.length > 0
    ? nonTechnical.reduce(
        (latest, a) => (new Date(a.createdAt).getTime() > new Date(latest).getTime() ? a.createdAt : latest),
        nonTechnical[0].createdAt
      )
    : null;

  return {
    overallScore,
    trendDelta,
    band: getSeverityBand(overallScore),
    pagesAudited: nonTechnical.length,
    lastAuditAt,
  };
}

// Static, curated benchmark figures (not live cross-account aggregation — see
// the evidence-based criteria library for the same approach applied elsewhere).
export const CATEGORY_BENCHMARKS: Record<string, { accountAvg: number; topQuartile: number }> = {
  "content-hierarchy": { accountAvg: 55, topQuartile: 80 },
  navigation: { accountAvg: 58, topQuartile: 82 },
  performance: { accountAvg: 52, topQuartile: 78 },
  accessibility: { accountAvg: 50, topQuartile: 75 },
  "visual-friction": { accountAvg: 60, topQuartile: 85 },
  "ux-friction": { accountAvg: 54, topQuartile: 79 },
  "trust-credibility": { accountAvg: 55, topQuartile: 80 },
  "form-friction": { accountAvg: 53, topQuartile: 78 },
  "cta-effectiveness": { accountAvg: 56, topQuartile: 81 },
  "checkout-friction": { accountAvg: 50, topQuartile: 76 },
};

export interface CategoryScoreEntry {
  category: string;
  label: string;
  score: number;
  deltaVsBenchmark: number;
  siteCount: number;
  worstSite?: { url: string; score: number };
}

export const MIN_LIVE_BENCHMARK_SAMPLES = 5;

export interface LiveBenchmarkStats {
  accountAvg: number;
  topQuartile: number;
  sampleCount: number;
}

export function buildCategoryScoreBreakdown(
  analyses: AnalysisRecord[],
  domain: string | null,
  liveBenchmarks: Record<string, LiveBenchmarkStats> = {}
): CategoryScoreEntry[] {
  const filtered = analyses
    .filter((a) => a.analysisType !== "technical")
    .filter((a) => !domain || getDomain(a.url) === domain)
    .filter((a): a is AnalysisRecord & { categoryScores: Record<string, number> } => !!a.categoryScores);

  const byCategory = new Map<string, { score: number; url: string }[]>();
  for (const a of filtered) {
    for (const [category, score] of Object.entries(a.categoryScores)) {
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push({ score, url: a.url });
    }
  }

  const entries: CategoryScoreEntry[] = [];
  for (const [category, points] of byCategory) {
    const avgScore = Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length);
    const live = liveBenchmarks[category];
    const benchmark = live && live.sampleCount >= MIN_LIVE_BENCHMARK_SAMPLES ? live : CATEGORY_BENCHMARKS[category];
    const worstSite = points.reduce((min, p) => (p.score < min.score ? p : min), points[0]);

    entries.push({
      category,
      label: categoryLabels[category] ?? category,
      score: avgScore,
      deltaVsBenchmark: benchmark ? avgScore - benchmark.accountAvg : 0,
      siteCount: new Set(points.map((p) => getDomain(p.url))).size,
      worstSite: { url: worstSite.url, score: worstSite.score },
    });
  }

  return entries.sort((a, b) => a.deltaVsBenchmark - b.deltaVsBenchmark);
}

export interface IssueMomentum {
  newSinceLastScan: number;
  resolvedSinceLastScan: number;
}

export function buildIssueMomentum(items: ActionItem[], analyses: AnalysisRecord[], domain: string | null): IssueMomentum {
  const filteredAnalyses = analyses
    .filter((a) => a.analysisType !== "technical")
    .filter((a) => !domain || getDomain(a.url) === domain)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const baseline = filteredAnalyses[1]?.createdAt;
  if (!baseline) return { newSinceLastScan: 0, resolvedSinceLastScan: 0 };

  const baselineTime = new Date(baseline).getTime();
  const filteredItems = items.filter((i) => !domain || getDomain(i.url) === domain);

  return {
    newSinceLastScan: filteredItems.filter((i) => new Date(i.createdAt).getTime() > baselineTime).length,
    resolvedSinceLastScan: filteredItems.filter(
      (i) => i.status === "resolved" && i.resolvedAt && new Date(i.resolvedAt).getTime() > baselineTime
    ).length,
  };
}
