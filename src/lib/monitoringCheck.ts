import type { FrictionPointInput } from "./firebase/actionItems";

export const SCORE_DROP_THRESHOLD = 5;

export interface MonitoringAlertInput {
  previousScore: number;
  newScore: number;
  previousCriticalTitles: string[];
  newFrictionPoints: FrictionPointInput[];
}

export interface MonitoringAlertResult {
  scoreDelta: number;
  newCriticalIssueTitles: string[];
}

export function detectMonitoringAlert(input: MonitoringAlertInput): MonitoringAlertResult | null {
  const { previousScore, newScore, previousCriticalTitles, newFrictionPoints } = input;
  const scoreDelta = newScore - previousScore;
  const scoreDropped = scoreDelta <= -SCORE_DROP_THRESHOLD;

  const previousSet = new Set(previousCriticalTitles);
  const newCriticalIssueTitles = newFrictionPoints
    .filter((fp) => fp.severity === "high" && !previousSet.has(fp.title))
    .map((fp) => fp.title);

  if (!scoreDropped && newCriticalIssueTitles.length === 0) return null;

  return { scoreDelta, newCriticalIssueTitles };
}
