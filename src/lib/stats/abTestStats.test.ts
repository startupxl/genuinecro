import { describe, it, expect } from "vitest";
import { normalCDF, inverseNormalCDF, calculateSampleSize, runSignificanceTest } from "./abTestStats";

describe("normalCDF", () => {
  it("returns 0.5 at z=0", () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it("returns ~0.975 at z=1.96 (standard 95% two-tailed boundary)", () => {
    expect(normalCDF(1.96)).toBeCloseTo(0.975, 3);
  });

  it("returns ~0.025 at z=-1.96", () => {
    expect(normalCDF(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("approaches 1 for large positive z", () => {
    expect(normalCDF(5)).toBeCloseTo(1, 4);
  });

  it("approaches 0 for large negative z", () => {
    expect(normalCDF(-5)).toBeCloseTo(0, 4);
  });
});

describe("inverseNormalCDF", () => {
  it("returns ~1.96 for p=0.975 (95% two-tailed z-score)", () => {
    expect(inverseNormalCDF(0.975)).toBeCloseTo(1.96, 2);
  });

  it("returns ~1.645 for p=0.95 (90% two-tailed / one-tailed 95%)", () => {
    expect(inverseNormalCDF(0.95)).toBeCloseTo(1.645, 2);
  });

  it("returns ~0.8416 for p=0.8 (80% power)", () => {
    expect(inverseNormalCDF(0.8)).toBeCloseTo(0.8416, 3);
  });

  it("returns ~1.2816 for p=0.9 (90% power)", () => {
    expect(inverseNormalCDF(0.9)).toBeCloseTo(1.2816, 3);
  });

  it("returns 0 at p=0.5", () => {
    expect(inverseNormalCDF(0.5)).toBeCloseTo(0, 4);
  });

  it("round-trips through normalCDF", () => {
    const z = inverseNormalCDF(0.9);
    expect(normalCDF(z)).toBeCloseTo(0.9, 4);
  });
});

describe("calculateSampleSize", () => {
  it("computes a reasonable sample size for a 3% baseline, 10% relative MDE, 95%/80%", () => {
    const result = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 10 });
    // Hand-verified: p1=0.03, p2=0.033, zα=1.9600, zβ=0.8416 → n ≈ 52,327 per variant.
    // Detecting a small relative lift on a low baseline genuinely needs a large sample.
    expect(result.samplePerVariant).toBeGreaterThan(50000);
    expect(result.samplePerVariant).toBeLessThan(56000);
    expect(result.totalSample).toBe(result.samplePerVariant * 2);
  });

  it("requires a larger sample for a smaller minimum detectable effect", () => {
    const bigEffect = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 20 });
    const smallEffect = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 5 });
    expect(smallEffect.samplePerVariant).toBeGreaterThan(bigEffect.samplePerVariant);
  });

  it("requires a larger sample for a higher confidence level", () => {
    const lowerConfidence = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 10, confidenceLevel: 90 });
    const higherConfidence = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 10, confidenceLevel: 99 });
    expect(higherConfidence.samplePerVariant).toBeGreaterThan(lowerConfidence.samplePerVariant);
  });

  it("defaults to 95% confidence and 80% power when not specified", () => {
    const withDefaults = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 10 });
    const explicit = calculateSampleSize({ baselineConversionRate: 3, minimumDetectableEffect: 10, confidenceLevel: 95, statisticalPower: 80 });
    expect(withDefaults.samplePerVariant).toBe(explicit.samplePerVariant);
  });
});

describe("runSignificanceTest", () => {
  it("detects a clearly significant result with a large sample and clear lift", () => {
    const result = runSignificanceTest({
      controlVisitors: 10000, controlConversions: 300,
      variantVisitors: 10000, variantConversions: 400,
    });
    expect(result.controlRate).toBeCloseTo(3, 5);
    expect(result.variantRate).toBeCloseTo(4, 5);
    expect(result.relativeLift).toBeCloseTo(33.333, 2);
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("does not flag a small, noisy difference from a tiny sample as significant", () => {
    const result = runSignificanceTest({
      controlVisitors: 50, controlConversions: 5,
      variantVisitors: 50, variantConversions: 6,
    });
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it("reports no lift and a p-value of 1 for identical rates", () => {
    const result = runSignificanceTest({
      controlVisitors: 1000, controlConversions: 100,
      variantVisitors: 1000, variantConversions: 100,
    });
    expect(result.relativeLift).toBe(0);
    expect(result.zScore).toBe(0);
    expect(result.pValue).toBeCloseTo(1, 4);
    expect(result.isSignificant).toBe(false);
  });

  it("respects a custom confidence level", () => {
    const input = {
      controlVisitors: 2000, controlConversions: 100,
      variantVisitors: 2000, variantConversions: 130,
    };
    const at90 = runSignificanceTest({ ...input, confidenceLevel: 90 });
    const at99 = runSignificanceTest({ ...input, confidenceLevel: 99 });
    // Same p-value regardless of the confidence threshold used to judge it...
    expect(at90.pValue).toBeCloseTo(at99.pValue, 6);
    // ...but the significance verdict can differ by threshold.
    expect(at90.confidenceLevel).toBe(90);
    expect(at99.confidenceLevel).toBe(99);
  });
});
