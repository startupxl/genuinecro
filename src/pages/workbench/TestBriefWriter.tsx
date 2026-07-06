import { useState } from "react";
import { FileText, RefreshCw, Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { generateTestBrief, type TestBriefResult } from "@/lib/api/testBrief";
import { toast } from "sonner";

const TestBriefWriter = () => {
  const capabilities = usePlanCapabilities();
  const upgradeMessage = getUpgradeMessage("workbench");
  const [page, setPage] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestBriefResult | null>(null);

  const handleGenerate = async () => {
    if (!page.trim() || !hypothesis.trim() || !goal.trim()) return;

    setIsRunning(true);
    setResult(null);
    try {
      const data = await generateTestBrief({
        hypothesis: hypothesis.trim(),
        page: page.trim(),
        goal: goal.trim(),
        context: context.trim(),
      });
      setResult(data);
    } catch (err) {
      toast.error("Test brief generation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!capabilities.canExperimentWorkbench) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl">
          <h1 className="text-xl font-semibold text-foreground font-display mb-1">Test Brief Writer</h1>
          <div className="bg-secondary rounded-md p-4 flex items-start gap-3 max-w-md mt-6">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{upgradeMessage.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{upgradeMessage.description}</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Test Brief Writer</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Turn a hypothesis into a complete, ready-to-share test brief for stakeholder review.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Page or URL</label>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="startupxl.com/pricing"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hypothesis</label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. A single, high-contrast CTA will outperform three competing CTAs"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-foreground resize-none"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Primary conversion goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Signups"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Additional context (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Traffic is roughly 5,000 visitors/week"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-foreground resize-none"
              disabled={isRunning}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isRunning || !page.trim() || !hypothesis.trim() || !goal.trim()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {isRunning ? "Generating…" : "Generate Brief"}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Problem Statement</p>
              <p className="text-sm text-foreground">{result.problemStatement}</p>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hypothesis</p>
              <p className="text-sm text-foreground">{result.hypothesis}</p>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Success Metric</p>
                <p className="text-sm font-medium text-foreground">{result.successMetric}</p>
              </div>
              {result.secondaryMetrics.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Secondary Metrics</p>
                  <p className="text-sm text-foreground">{result.secondaryMetrics.join(", ")}</p>
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Variants</p>
              <div className="space-y-3">
                {result.variants.map((variant) => (
                  <div key={variant.name} className="bg-background rounded-md p-3 border border-border/50">
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">{variant.name}</p>
                    <p className="text-sm text-foreground mt-1">{variant.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Audience &amp; Split</p>
                <p className="text-sm text-foreground">{result.audienceAndSplit}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Estimated Duration</p>
                <p className="text-sm text-foreground">{result.estimatedDuration}</p>
              </div>
            </div>

            {result.risks.length > 0 && (
              <div className="bg-primary/[0.04] border border-primary/20 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Risks</p>
                <ul className="space-y-1.5">
                  {result.risks.map((risk, i) => (
                    <li key={i} className="text-sm text-foreground">
                      • {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default TestBriefWriter;
