import type { FunnelInsights } from "@/lib/firebase/funnels";

export interface FunnelInsightStep {
  label: string;
  url: string;
  score: number;
  topIssues: string[];
  ga4?: { bounceRate: number; engagementRate: number; sessions: number } | null;
}

export async function analyzeFunnel(steps: FunnelInsightStep[]): Promise<FunnelInsights> {
  const response = await fetch("/api/funnel-insights/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Funnel analysis failed");
  }

  return data.data as FunnelInsights;
}
