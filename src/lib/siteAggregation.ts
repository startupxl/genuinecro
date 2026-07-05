import type { ActionItem, EvidenceBenchmark, EvidenceABTest } from "./firebase/actionItems";
import { getDomain } from "./dashboardMetrics";

export interface AggregatedFrictionPoint {
  key: string;
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  avgImpactScore: number;
  affectedUrls: string[];
  selector?: string;
  roiEstimate?: string;
  insightCluster?: string;
  screenshotUrl?: string;
  sourceCitation?: string;
  benchmark?: EvidenceBenchmark;
  abTest?: EvidenceABTest;
}

const severityRank: Record<ActionItem["severity"], number> = { low: 0, med: 1, high: 2 };

/**
 * Merges open action items for a domain into one row per distinct issue
 * (category + title), so the same friction point found on many pages shows
 * up once with the list of affected pages, instead of once per page.
 */
export function buildSiteFrictionSummary(items: ActionItem[], domain: string): AggregatedFrictionPoint[] {
  const domainItems = items.filter((item) => item.status !== "resolved" && getDomain(item.url) === domain);

  // Sort most-recent-first so each group's first-seen item is its representative.
  const sorted = [...domainItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  interface Group {
    representative: ActionItem;
    urls: Set<string>;
    impactScores: number[];
    severity: ActionItem["severity"];
  }

  const groups = new Map<string, Group>();

  for (const item of sorted) {
    const key = `${item.category}::${item.title}`;
    let group = groups.get(key);
    if (!group) {
      group = { representative: item, urls: new Set(), impactScores: [], severity: item.severity };
      groups.set(key, group);
    }
    group.urls.add(item.url);
    group.impactScores.push(item.impactScore);
    if (severityRank[item.severity] > severityRank[group.severity]) {
      group.severity = item.severity;
    }
  }

  return [...groups.entries()]
    .map(([key, { representative, urls, impactScores, severity }]) => ({
      key,
      category: representative.category,
      severity,
      title: representative.title,
      description: representative.description,
      fix: representative.fix,
      avgImpactScore: Math.round(impactScores.reduce((sum, n) => sum + n, 0) / impactScores.length),
      affectedUrls: [...urls].sort(),
      selector: representative.selector,
      roiEstimate: representative.roiEstimate,
      insightCluster: representative.insightCluster,
      screenshotUrl: representative.screenshotUrl,
      sourceCitation: representative.sourceCitation,
      benchmark: representative.benchmark,
      abTest: representative.abTest,
    }))
    .sort((a, b) => b.avgImpactScore - a.avgImpactScore);
}
