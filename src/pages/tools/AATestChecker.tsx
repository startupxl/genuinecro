import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import PublicToolLayout from "@/components/PublicToolLayout";
import { runSignificanceTest, type SignificanceTestResult } from "@/lib/stats/abTestStats";

const AATestChecker = () => {
  const [aVisitors, setAVisitors] = useState("");
  const [aConversions, setAConversions] = useState("");
  const [bVisitors, setBVisitors] = useState("");
  const [bConversions, setBConversions] = useState("");
  const [result, setResult] = useState<SignificanceTestResult | null>(null);

  const isComplete = aVisitors !== "" && aConversions !== "" && bVisitors !== "" && bConversions !== "";

  const handleCheck = () => {
    if (!isComplete) return;
    setResult(
      runSignificanceTest({
        controlVisitors: Number(aVisitors),
        controlConversions: Number(aConversions),
        variantVisitors: Number(bVisitors),
        variantConversions: Number(bConversions),
      })
    );
  };

  return (
    <PublicToolLayout
      title="A/A Test Checker"
      description="Run two identical variants against each other. If the difference is 'significant,' something's wrong with your test setup — not your users."
    >
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label htmlFor="a-visitors" className="text-xs text-muted-foreground block mb-1">
            Variant A visitors
          </label>
          <input
            id="a-visitors"
            type="number"
            value={aVisitors}
            onChange={(e) => setAVisitors(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="a-conversions" className="text-xs text-muted-foreground block mb-1">
            Variant A conversions
          </label>
          <input
            id="a-conversions"
            type="number"
            value={aConversions}
            onChange={(e) => setAConversions(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="b-visitors" className="text-xs text-muted-foreground block mb-1">
            Variant B visitors
          </label>
          <input
            id="b-visitors"
            type="number"
            value={bVisitors}
            onChange={(e) => setBVisitors(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="b-conversions" className="text-xs text-muted-foreground block mb-1">
            Variant B conversions
          </label>
          <input
            id="b-conversions"
            type="number"
            value={bConversions}
            onChange={(e) => setBConversions(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          />
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={!isComplete}
        className="mt-4 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        Check
      </button>

      {result && (
        <div
          className={`mt-6 max-w-md rounded-lg p-4 border flex items-start gap-2 ${
            result.isSignificant ? "bg-destructive/[0.04] border-destructive/20" : "bg-primary/[0.04] border-primary/20"
          }`}
        >
          {result.isSignificant ? (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${result.isSignificant ? "text-destructive" : "text-primary"}`}>
              {result.isSignificant ? "Likely setup problem detected" : "No issues detected"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {result.isSignificant
                ? `Variant A (${result.controlRate.toFixed(2)}%) and Variant B (${result.variantRate.toFixed(2)}%) are showing a statistically significant difference (p = ${result.pValue.toFixed(4)}) even though they're the same experience. Check your randomization, tracking, or bucketing logic before trusting other tests on this setup.`
                : `Variant A (${result.controlRate.toFixed(2)}%) and Variant B (${result.variantRate.toFixed(2)}%) show no statistically significant difference (p = ${result.pValue.toFixed(4)}), as expected for two identical variants.`}
            </p>
          </div>
        </div>
      )}
    </PublicToolLayout>
  );
};

export default AATestChecker;
