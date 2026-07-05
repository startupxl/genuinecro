import type { AnalysisRecord } from "./firebase/analyses";
import type { ActionItem, EvidenceBenchmark, EvidenceABTest } from "./firebase/actionItems";
import type { LiveBenchmarkStats } from "./firebase/benchmarks";
import { CATEGORY_BENCHMARKS, MIN_LIVE_BENCHMARK_SAMPLES } from "./dashboardMetrics";
import type { AnalysisResult, AnalysisType, CategoryScore, FrictionCategory, FrictionPoint } from "./mockData";

const DEFAULT_BENCHMARK: EvidenceBenchmark = { industryAvg: 50, topPerformers: 80, label: "" };
const DEFAULT_ABTEST: EvidenceABTest = { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" };
const DEFAULT_INDUSTRY_AVG = 55;
const DEFAULT_TOP_QUARTILE = 80;

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

  const average = (values: number[], fallback: number) =>
    values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : fallback;

  return {
    url: scan.url,
    timestamp: scan.createdAt,
    device: scan.device as "desktop" | "mobile",
    analysisType: scan.analysisType as AnalysisType,
    conversionScore: scan.conversionScore,
    frictionPoints: matchedItems.map(toFrictionPoint),
    benchmark: {
      overallScore: scan.conversionScore,
      industryAvg: average(accountAvgs, DEFAULT_INDUSTRY_AVG),
      topQuartile: average(topQuartiles, DEFAULT_TOP_QUARTILE),
      categoryScores,
    },
  };
}
