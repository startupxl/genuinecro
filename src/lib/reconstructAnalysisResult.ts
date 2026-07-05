import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem, EvidenceBenchmark, EvidenceABTest } from "./firebase/actionItems";
import type { LiveBenchmarkStats } from "./firebase/benchmarks";
import { CATEGORY_BENCHMARKS, MIN_LIVE_BENCHMARK_SAMPLES } from "./dashboardMetrics";
import { buildSiteFrictionSummary } from "./siteAggregation";
import type { AnalysisResult, AnalysisType, CategoryScore, FrictionCategory, FrictionPoint } from "./mockData";

const DEFAULT_BENCHMARK: EvidenceBenchmark = { industryAvg: 50, topPerformers: 80, label: "" };
const DEFAULT_ABTEST: EvidenceABTest = { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" };
const DEFAULT_INDUSTRY_AVG = 55;
const DEFAULT_TOP_QUARTILE = 80;

function average(values: number[], fallback: number): number {
  return values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : fallback;
}

function toFrictionPoint(item: ActionItem): FrictionPoint {
  return {
    id: item.id,
    category: item.category as FrictionCategory,
    severity: item.severity,
    title: item.title,
    description: item.description,
    selector: item.selector ?? "",
    fix: item.fix,
    impactScore: item.impactScore,
    roiEstimate: item.roiEstimate,
    insightCluster: item.insightCluster,
    screenshotUrl: item.screenshotUrl,
    sourceCitation: item.sourceCitation,
    benchmark: item.benchmark ?? DEFAULT_BENCHMARK,
    abTest: item.abTest ?? DEFAULT_ABTEST,
  };
}

export function buildAnalysisResultFromScan(
  scan: AnalysisRecord,
  matchedItems: ActionItem[],
  liveBenchmarks: Record<string, LiveBenchmarkStats>
): AnalysisResult {
  const categoryScores: Partial<Record<string, CategoryScore>> = {};
  const accountAvgs: number[] = [];
  const topQuartiles: number[] = [];

  for (const [category, score] of Object.entries(scan.categoryScores ?? {})) {
    const live = liveBenchmarks[category];
    const benchmark = live && live.sampleCount >= MIN_LIVE_BENCHMARK_SAMPLES ? live : CATEGORY_BENCHMARKS[category];
    categoryScores[category] = {
      score,
      industryAvg: benchmark?.accountAvg ?? DEFAULT_INDUSTRY_AVG,
    };
    if (benchmark) {
      accountAvgs.push(benchmark.accountAvg);
      topQuartiles.push(benchmark.topQuartile);
    }
  }

  return {
    url: scan.url,
    timestamp: scan.createdAt,
    device: scan.device as "desktop" | "mobile",
    analysisType: scan.analysisType as AnalysisType,
    conversionScore: scan.conversionScore,
    frictionPoints: matchedItems.map(toFrictionPoint),
    conversionGoal: scan.conversionGoal,
    benchmark: {
      overallScore: scan.conversionScore,
      industryAvg: average(accountAvgs, DEFAULT_INDUSTRY_AVG),
      topQuartile: average(topQuartiles, DEFAULT_TOP_QUARTILE),
      categoryScores,
    },
  };
}

/**
 * Reconstructs a domain-wide AnalysisResult so /sites/:domain can render
 * through the exact same AnalysisView used for a single audit, instead of a
 * bespoke layout. Friction points are merged across pages (see
 * buildSiteFrictionSummary); category scores are averaged across every page
 * audited under the domain; url/device/analysisType/score are taken from the
 * most recently scanned page as a representative snapshot.
 */
export function buildAnalysisResultFromSite(
  domain: string,
  domainRecords: AnalysisRecord[],
  allActionItems: ActionItem[],
  liveBenchmarks: Record<string, LiveBenchmarkStats>
): AnalysisResult {
  const categoryScoreSamples = new Map<string, number[]>();
  for (const record of domainRecords) {
    for (const [category, score] of Object.entries(record.categoryScores ?? {})) {
      if (!categoryScoreSamples.has(category)) categoryScoreSamples.set(category, []);
      categoryScoreSamples.get(category)!.push(score);
    }
  }

  const categoryScores: Partial<Record<string, CategoryScore>> = {};
  const accountAvgs: number[] = [];
  const topQuartiles: number[] = [];

  for (const [category, scores] of categoryScoreSamples) {
    const live = liveBenchmarks[category];
    const benchmark = live && live.sampleCount >= MIN_LIVE_BENCHMARK_SAMPLES ? live : CATEGORY_BENCHMARKS[category];
    categoryScores[category] = {
      score: average(scores, DEFAULT_INDUSTRY_AVG),
      industryAvg: benchmark?.accountAvg ?? DEFAULT_INDUSTRY_AVG,
    };
    if (benchmark) {
      accountAvgs.push(benchmark.accountAvg);
      topQuartiles.push(benchmark.topQuartile);
    }
  }

  const latest = [...domainRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  const frictionPoints: FrictionPoint[] = buildSiteFrictionSummary(allActionItems, domain).map((point) => ({
    id: point.key,
    category: point.category as FrictionCategory,
    severity: point.severity,
    title: point.title,
    description: point.description,
    selector: point.selector ?? "",
    fix: point.fix,
    impactScore: point.avgImpactScore,
    roiEstimate: point.roiEstimate,
    insightCluster: point.insightCluster,
    screenshotUrl: point.screenshotUrl,
    sourceCitation: point.sourceCitation,
    benchmark: point.benchmark ?? DEFAULT_BENCHMARK,
    abTest: point.abTest ?? DEFAULT_ABTEST,
    affectedUrls: point.affectedUrls,
  }));

  return {
    url: `https://${domain}`,
    timestamp: latest.createdAt,
    device: latest.device as "desktop" | "mobile",
    analysisType: latest.analysisType as AnalysisType,
    conversionScore: latest.conversionScore,
    frictionPoints,
    conversionGoal: latest.conversionGoal,
    benchmark: {
      overallScore: latest.conversionScore,
      industryAvg: average(accountAvgs, DEFAULT_INDUSTRY_AVG),
      topQuartile: average(topQuartiles, DEFAULT_TOP_QUARTILE),
      categoryScores,
    },
  };
}
