/** Abramowitz & Stegun 7.1.26 approximation of the error function (max error ~1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal cumulative distribution function, Φ(z). */
export function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Inverse standard normal CDF (probit function) via Peter Acklam's rational approximation
 * (relative error < 1.15e-9 across (0,1)).
 */
export function inverseNormalCDF(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export interface SampleSizeInput {
  /** Baseline conversion rate as a percentage, e.g. 3 for 3%. */
  baselineConversionRate: number;
  /** Minimum detectable effect as a relative percentage lift, e.g. 10 for a 10% relative improvement. */
  minimumDetectableEffect: number;
  /** Two-tailed confidence level as a percentage. Defaults to 95. */
  confidenceLevel?: number;
  /** Statistical power as a percentage. Defaults to 80. */
  statisticalPower?: number;
}

export interface SampleSizeResult {
  samplePerVariant: number;
  totalSample: number;
}

export function calculateSampleSize(input: SampleSizeInput): SampleSizeResult {
  const { baselineConversionRate, minimumDetectableEffect, confidenceLevel = 95, statisticalPower = 80 } = input;

  const p1 = baselineConversionRate / 100;
  const p2 = p1 * (1 + minimumDetectableEffect / 100);

  const zAlpha = inverseNormalCDF(1 - (1 - confidenceLevel / 100) / 2);
  const zBeta = inverseNormalCDF(statisticalPower / 100);

  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p2 - p1, 2);

  const samplePerVariant = Math.ceil(numerator / denominator);
  return { samplePerVariant, totalSample: samplePerVariant * 2 };
}

export interface SignificanceTestInput {
  controlVisitors: number;
  controlConversions: number;
  variantVisitors: number;
  variantConversions: number;
  /** Two-tailed confidence level as a percentage. Defaults to 95. */
  confidenceLevel?: number;
}

export interface SignificanceTestResult {
  controlRate: number;
  variantRate: number;
  relativeLift: number;
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number;
}

export function runSignificanceTest(input: SignificanceTestInput): SignificanceTestResult {
  const { controlVisitors, controlConversions, variantVisitors, variantConversions, confidenceLevel = 95 } = input;

  const p1 = controlConversions / controlVisitors;
  const p2 = variantConversions / variantVisitors;
  const pPooled = (controlConversions + variantConversions) / (controlVisitors + variantVisitors);

  const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1 / controlVisitors + 1 / variantVisitors));
  const zScore = standardError === 0 ? 0 : (p2 - p1) / standardError;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  const alpha = 1 - confidenceLevel / 100;

  return {
    controlRate: p1 * 100,
    variantRate: p2 * 100,
    relativeLift: p1 === 0 ? 0 : ((p2 - p1) / p1) * 100,
    zScore,
    pValue,
    isSignificant: pValue < alpha,
    confidenceLevel,
  };
}
