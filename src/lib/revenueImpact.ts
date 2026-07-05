import type { SiteSettings } from "./firebase/siteSettings";

export interface RoiPercentRange {
  low: number;
  high: number;
}

export function parseRoiPercentRange(roiEstimate: string | undefined): RoiPercentRange | null {
  if (!roiEstimate) return null;
  const match = roiEstimate.match(/(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?%/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return { low, high };
}

export interface RevenueImpactRange {
  low: number;
  high: number;
}

export function computeRevenueImpact(
  settings: SiteSettings | null | undefined,
  roiEstimate: string | undefined
): RevenueImpactRange | null {
  if (!settings) return null;
  const { monthlyTraffic, averageOrderValue, baselineConversionRate } = settings;
  if (!monthlyTraffic || !averageOrderValue || !baselineConversionRate) return null;

  const range = parseRoiPercentRange(roiEstimate);
  if (!range) return null;

  const baselineConversions = monthlyTraffic * (baselineConversionRate / 100);
  const low = Math.round(baselineConversions * (range.low / 100) * averageOrderValue);
  const high = Math.round(baselineConversions * (range.high / 100) * averageOrderValue);
  return { low, high };
}
