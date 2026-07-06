import { useState } from "react";
import PublicToolLayout from "@/components/PublicToolLayout";
import { runSignificanceTest, type SignificanceTestResult } from "@/lib/stats/abTestStats";

const SignificanceCalculator = () => {
  const [controlVisitors, setControlVisitors] = useState("");
  const [controlConversions, setControlConversions] = useState("");
  const [variantVisitors, setVariantVisitors] = useState("");
  const [variantConversions, setVariantConversions] = useState("");
  const [result, setResult] = useState<SignificanceTestResult | null>(null);

  const isComplete = controlVisitors !== "" && controlConversions !== "" && variantVisitors !== "" && variantConversions !== "";

  const handleCalculate = () => {
    if (!isComplete) return;
    setResult(
      runSignificanceTest({
        controlVisitors: Number(controlVisitors),
        controlConversions: Number(controlConversions),
        variantVisitors: Number(variantVisitors),
        variantConversions: Number(variantConversions),
      })
    );
  };

  return (
    <PublicToolLayout
      title="A/B Test Significance Calculator"
      description="Paste your test results from any platform and find out whether the difference is real or just noise."
    >
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label htmlFor="control-visitors" className="text-xs text-muted-foreground block mb-1">
            Control visitors
          </label>
          <input
            id="control-visitors"
            type="number"
            value={controlVisitors}
            onChange={(e) => setControlVisitors(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="control-conversions" className="text-xs text-muted-foreground block mb-1">
            Control conversions
          </label>
          <input
            id="control-conversions"
            type="number"
            value={controlConversions}
            onChange={(e) => setControlConversions(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="variant-visitors" className="text-xs text-muted-foreground block mb-1">
            Variant visitors
          </label>
          <input
            id="variant-visitors"
            type="number"
            value={variantVisitors}
            onChange={(e) => setVariantVisitors(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="variant-conversions" className="text-xs text-muted-foreground block mb-1">
            Variant conversions
          </label>
          <input
            id="variant-conversions"
            type="number"
            value={variantConversions}
            onChange={(e) => setVariantConversions(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
      </div>

      <button
        onClick={handleCalculate}
        disabled={!isComplete}
        className="mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        Calculate
      </button>

      {result && (
        <div className="mt-6 space-y-3 max-w-md">
          <div
            className={`rounded-lg p-4 border ${
              result.isSignificant ? "bg-primary/[0.04] border-primary/20" : "bg-secondary border-border"
            }`}
          >
            <p className={`text-sm font-medium ${result.isSignificant ? "text-primary" : "text-muted-foreground"}`}>
              {result.isSignificant ? "Significant" : "Not significant"} at {result.confidenceLevel}% confidence
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              p-value: {result.pValue.toFixed(4)} · z-score: {result.zScore.toFixed(2)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Control rate</p>
              <p className="text-lg font-semibold text-foreground">{result.controlRate.toFixed(2)}%</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Variant rate</p>
              <p className="text-lg font-semibold text-foreground">{result.variantRate.toFixed(2)}%</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Relative lift</p>
              <p className={`text-lg font-semibold ${result.relativeLift >= 0 ? "text-primary" : "text-destructive"}`}>
                {result.relativeLift >= 0 ? "+" : ""}
                {result.relativeLift.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </PublicToolLayout>
  );
};

export default SignificanceCalculator;
