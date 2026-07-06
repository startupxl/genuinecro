import { useState } from "react";
import PublicToolLayout from "@/components/PublicToolLayout";
import { calculateSampleSize, type SampleSizeResult } from "@/lib/stats/abTestStats";

const SampleSizeCalculator = () => {
  const [baselineConversionRate, setBaselineConversionRate] = useState("3");
  const [minimumDetectableEffect, setMinimumDetectableEffect] = useState("10");
  const [confidenceLevel, setConfidenceLevel] = useState("95");
  const [statisticalPower, setStatisticalPower] = useState("80");
  const [result, setResult] = useState<SampleSizeResult | null>(null);

  const handleCalculate = () => {
    const baseline = Number(baselineConversionRate);
    const mde = Number(minimumDetectableEffect);
    if (!baseline || !mde) return;
    setResult(
      calculateSampleSize({
        baselineConversionRate: baseline,
        minimumDetectableEffect: mde,
        confidenceLevel: Number(confidenceLevel),
        statisticalPower: Number(statisticalPower),
      })
    );
  };

  return (
    <PublicToolLayout
      title="A/B Test Sample Size Calculator"
      description="Figure out how many visitors each variant needs before you can trust your test's results. Works with any A/B testing tool — Optimizely, VWO, Google Optimize, or a homegrown setup."
    >
      <div className="space-y-4 max-w-md">
        <div>
          <label htmlFor="baseline-rate" className="text-xs text-muted-foreground block mb-1">
            Baseline conversion rate (%)
          </label>
          <input
            id="baseline-rate"
            type="number"
            value={baselineConversionRate}
            onChange={(e) => setBaselineConversionRate(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="mde" className="text-xs text-muted-foreground block mb-1">
            Minimum detectable effect (% relative lift)
          </label>
          <input
            id="mde"
            type="number"
            value={minimumDetectableEffect}
            onChange={(e) => setMinimumDetectableEffect(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="confidence-level" className="text-xs text-muted-foreground block mb-1">
              Confidence level (%)
            </label>
            <select
              id="confidence-level"
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
            >
              <option value="90">90%</option>
              <option value="95">95%</option>
              <option value="99">99%</option>
            </select>
          </div>
          <div>
            <label htmlFor="statistical-power" className="text-xs text-muted-foreground block mb-1">
              Statistical power (%)
            </label>
            <select
              id="statistical-power"
              value={statisticalPower}
              onChange={(e) => setStatisticalPower(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
            >
              <option value="80">80%</option>
              <option value="90">90%</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleCalculate}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Calculate
        </button>
      </div>

      {result && (
        <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sample size per variant</p>
            <p className="text-2xl font-semibold text-foreground">{result.samplePerVariant.toLocaleString()}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total sample needed</p>
            <p className="text-2xl font-semibold text-foreground">{result.totalSample.toLocaleString()}</p>
          </div>
        </div>
      )}
    </PublicToolLayout>
  );
};

export default SampleSizeCalculator;
