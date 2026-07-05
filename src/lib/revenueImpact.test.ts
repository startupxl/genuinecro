import { describe, it, expect } from "vitest";
import { parseRoiPercentRange, computeRevenueImpact } from "./revenueImpact";

describe("parseRoiPercentRange", () => {
  it("parses a percentage range like 'Could increase conversion by 15-30%'", () => {
    expect(parseRoiPercentRange("Could increase conversion by 15-30%")).toEqual({ low: 15, high: 30 });
  });

  it("parses a single percentage like 'May reduce bounce by 15%' as the same low/high", () => {
    expect(parseRoiPercentRange("May reduce bounce by 15%")).toEqual({ low: 15, high: 15 });
  });

  it("returns null when there is no percentage in the string", () => {
    expect(parseRoiPercentRange("Improves user trust")).toBeNull();
  });

  it("returns null when roiEstimate is undefined", () => {
    expect(parseRoiPercentRange(undefined)).toBeNull();
  });
});

describe("computeRevenueImpact", () => {
  const settings = { monthlyTraffic: 100000, averageOrderValue: 80, baselineConversionRate: 2.5 };

  it("computes a low/high monthly revenue range from traffic, AOV, baseline conversion, and the roi range", () => {
    // baseline conversions = 100000 * 0.025 = 2500/month
    // low: 2500 * 0.15 * $80 = $30,000; high: 2500 * 0.30 * $80 = $60,000
    const result = computeRevenueImpact(settings, "Could increase conversion by 15-30%");
    expect(result).toEqual({ low: 30000, high: 60000 });
  });

  it("returns null when the roiEstimate has no parseable percentage", () => {
    expect(computeRevenueImpact(settings, "Improves user trust")).toBeNull();
  });

  it("returns null when roiEstimate is absent", () => {
    expect(computeRevenueImpact(settings, undefined)).toBeNull();
  });

  it("returns null when monthlyTraffic is missing from settings", () => {
    const result = computeRevenueImpact({ averageOrderValue: 80, baselineConversionRate: 2.5 }, "Could increase conversion by 15-30%");
    expect(result).toBeNull();
  });

  it("returns null when averageOrderValue is missing from settings", () => {
    const result = computeRevenueImpact({ monthlyTraffic: 100000, baselineConversionRate: 2.5 }, "Could increase conversion by 15-30%");
    expect(result).toBeNull();
  });

  it("returns null when baselineConversionRate is missing from settings", () => {
    const result = computeRevenueImpact({ monthlyTraffic: 100000, averageOrderValue: 80 }, "Could increase conversion by 15-30%");
    expect(result).toBeNull();
  });

  it("returns null when settings is null", () => {
    expect(computeRevenueImpact(null, "Could increase conversion by 15-30%")).toBeNull();
  });
});
