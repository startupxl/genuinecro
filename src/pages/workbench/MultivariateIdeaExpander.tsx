import { useState } from "react";
import { Layers, RefreshCw, Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { expandMultivariateIdea, type MultivariateIdeaResult } from "@/lib/api/multivariateIdea";
import { toast } from "sonner";

const MultivariateIdeaExpander = () => {
  const capabilities = usePlanCapabilities();
  const upgradeMessage = getUpgradeMessage("workbench");
  const [pageContext, setPageContext] = useState("");
  const [baseIdea, setBaseIdea] = useState("");
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MultivariateIdeaResult | null>(null);

  const handleExpand = async () => {
    if (!pageContext.trim() || !baseIdea.trim() || !goal.trim()) return;

    setIsRunning(true);
    setResult(null);
    try {
      const data = await expandMultivariateIdea({
        baseIdea: baseIdea.trim(),
        pageContext: pageContext.trim(),
        goal: goal.trim(),
      });
      setResult(data);
    } catch (err) {
      toast.error("Idea expansion failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (capabilities.isLoading) {
    return <AppShell><div className="p-6" /></AppShell>;
  }

  if (!capabilities.canExperimentWorkbench) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl">
          <h1 className="text-xl font-semibold text-foreground font-display mb-1">Multivariate Idea Expander</h1>
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
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Multivariate Idea Expander</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Turn a single testing idea into factors, levels, and concrete combinations worth testing together.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Page or element</label>
            <input
              type="text"
              value={pageContext}
              onChange={(e) => setPageContext(e.target.value)}
              placeholder="e.g. Homepage hero section"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Base idea</label>
            <textarea
              value={baseIdea}
              onChange={(e) => setBaseIdea(e.target.value)}
              placeholder="e.g. Make the CTA button more prominent"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-foreground resize-none"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Conversion goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Signups"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <button
            onClick={handleExpand}
            disabled={isRunning || !pageContext.trim() || !baseIdea.trim() || !goal.trim()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            {isRunning ? "Expanding…" : "Expand Idea"}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Factors</p>
              <div className="space-y-3">
                {result.factors.map((factor) => (
                  <div key={factor.name}>
                    <p className="text-sm font-medium text-foreground">{factor.name}</p>
                    <ul className="mt-1 space-y-0.5">
                      {factor.levels.map((level) => (
                        <li key={level} className="text-sm text-muted-foreground">
                          {level}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Suggested Combinations</p>
              <div className="space-y-3">
                {result.suggestedCombinations.map((combo) => (
                  <div key={combo.label} className="bg-background rounded-md p-3 border border-border/50">
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">{combo.label}</p>
                    <p className="text-sm text-foreground mt-1">{combo.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{combo.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.testingNote && (
              <div className="bg-primary/[0.04] border border-primary/20 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Testing Note</p>
                <p className="text-sm text-foreground">{result.testingNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default MultivariateIdeaExpander;
