import { useState } from "react";
import { RefreshCw, Swords, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { detectPageType, categoryLabels } from "@/lib/mockData";
import { runMergedAudit, type MergedAuditResult } from "@/lib/mergedAudit";
import { buildCategoryComparison, summarizeGaps } from "@/lib/competitorComparison";
import AppShell from "@/components/AppShell";
import AuthPage from "@/components/AuthPage";
import { toast } from "sonner";

function formatUrl(raw: string): string {
  let formatted = raw.trim();
  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
    formatted = `https://${formatted}`;
  }
  return formatted;
}

const CompetitorComparison = () => {
  const { user } = useAuth();
  const [yourUrl, setYourUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isRunning, setIsRunning] = useState(false);
  const [yourResult, setYourResult] = useState<MergedAuditResult | null>(null);
  const [competitorResult, setCompetitorResult] = useState<MergedAuditResult | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const handleCompare = async () => {
    if (!yourUrl.trim() || !competitorUrl.trim()) return;
    if (!user) {
      setShowAuth(true);
      return;
    }

    const yours = formatUrl(yourUrl);
    const theirs = formatUrl(competitorUrl);

    setIsRunning(true);
    setYourResult(null);
    setCompetitorResult(null);
    try {
      const [yourAudit, competitorAudit] = await Promise.all([
        runMergedAudit(yours, detectPageType(yours), device),
        runMergedAudit(theirs, detectPageType(theirs), device),
      ]);
      setYourResult(yourAudit);
      setCompetitorResult(competitorAudit);
    } catch (err) {
      toast.error("Comparison failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message="Create an account to run competitor comparisons." />;
  }

  const comparisonRows =
    yourResult && competitorResult
      ? buildCategoryComparison(yourResult.benchmark.categoryScores, competitorResult.benchmark.categoryScores)
      : [];
  const { ahead, behind } = summarizeGaps(comparisonRows);

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Competitor Comparison</h1>
        <p className="text-sm text-muted-foreground mb-6">
          See how your page's conversion score stacks up against a competitor's, category by category.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Your page URL</label>
            <input
              type="text"
              value={yourUrl}
              onChange={(e) => setYourUrl(e.target.value)}
              placeholder="yoursite.com/page"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Competitor's page URL</label>
            <input
              type="text"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="competitor.com/page"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDevice("desktop")}
              disabled={isRunning}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                device === "desktop" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => setDevice("mobile")}
              disabled={isRunning}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                device === "mobile" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Mobile
            </button>
          </div>
          <button
            onClick={handleCompare}
            disabled={isRunning || !yourUrl.trim() || !competitorUrl.trim()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {isRunning ? "Comparing…" : "Compare"}
          </button>
        </div>

        {yourResult && competitorResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Your Score</p>
                <p className="text-2xl font-semibold text-foreground">{yourResult.conversionScore}/100</p>
              </div>
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Competitor Score</p>
                <p className="text-2xl font-semibold text-foreground">{competitorResult.conversionScore}/100</p>
              </div>
            </div>

            {ahead.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Where You're Ahead</p>
                <ul className="space-y-1.5">
                  {ahead.map((row) => (
                    <li key={row.category} className="text-sm text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {categoryLabels[row.category] || row.category}: {row.yourScore} vs {row.competitorScore} (+{row.delta})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {behind.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-friction-high mb-2">Where They're Ahead</p>
                <ul className="space-y-1.5">
                  {behind.map((row) => (
                    <li key={row.category} className="text-sm text-foreground flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-friction-high flex-shrink-0" />
                      {categoryLabels[row.category] || row.category}: {row.yourScore} vs {row.competitorScore} ({row.delta})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Full Category Breakdown</p>
              <div className="space-y-2">
                {comparisonRows.map((row) => (
                  <div key={row.category} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{categoryLabels[row.category] || row.category}</span>
                    <span className="font-mono text-foreground">
                      {row.yourScore} <span className="text-muted-foreground">vs</span> {row.competitorScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CompetitorComparison;
