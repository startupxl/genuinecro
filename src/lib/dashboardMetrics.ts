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
const severityOrder = ["high", "med", "low"];

export function buildSeverityBreakdown(items: ActionItem[], domain: string | null): CategoryBreakdownEntry[] {
  const filtered = items.filter((i) => !domain || getDomain(i.url) === domain);

  const counts = new Map<string, number>();
  for (const item of filtered) {
    counts.set(item.severity, (counts.get(item.severity) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([severity, count]) => ({ category: severity, label: severityLabels[severity] ?? severity, count }))
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
    if (item.status !== "open") continue;
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
