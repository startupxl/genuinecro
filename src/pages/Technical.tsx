import { useState, useCallback } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { createActionItems } from "@/lib/firebase/actionItems";
import { runTechnicalAudit, type TechnicalAuditResult } from "@/lib/api/technical";
import AppShell from "@/components/AppShell";
import AuthPage from "@/components/AuthPage";
import UpgradeWall from "@/components/UpgradeWall";
import { toast } from "sonner";

const severityBorderClass: Record<string, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const Technical = () => {
  const { user } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const [url, setUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TechnicalAuditResult | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);

  const handleRunAudit = useCallback(async () => {
    if (!url.trim()) return;
    if (usage.requiresAuth) {
      setShowAuth(true);
      return;
    }
    if (usage.requiresPaid) {
      setShowUpgradeWall(true);
      return;
    }

    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const audit = await runTechnicalAudit(formatted);
      setResult(audit);
      await trackAnalysis(formatted, "technical", "desktop", audit.technicalScore);
      if (user) await createActionItems(user.uid, formatted, "technical", audit.issues);
      toast.success(`Technical audit complete — score ${audit.technicalScore}/100`);
    } catch (err) {
      toast.error("Technical audit failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  }, [url, usage, trackAnalysis, user]);

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message="You've used your free audits. Create an account to get more!" />;
  }

  return (
    <AppShell>
      <div className="p-6">
      {showUpgradeWall && (
        <UpgradeWall
          used={usage.used}
          limit={usage.limit}
          isAnon={!user}
          onSignIn={() => {
            setShowUpgradeWall(false);
            setShowAuth(true);
          }}
        />
      )}

      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Technical</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          className="flex-1 h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          disabled={isRunning}
        />
        <button
          onClick={handleRunAudit}
          disabled={isRunning || !url.trim()}
          className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          {isRunning ? "Auditing…" : "Run Audit"}
        </button>
      </div>

      {result && (
        <>
          <div className="bg-surface border border-border rounded-lg p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Technical Score</p>
              <p className="text-2xl font-semibold text-foreground">{result.technicalScore}/100</p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <p>{result.checks.linkSummary.ok} of {result.checks.linkSummary.total} links healthy</p>
            </div>
          </div>

          {result.issues.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No technical issues found.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {result.issues.map((issue, i) => (
                <div
                  key={`${issue.title}-${i}`}
                  className={`bg-surface p-4 shadow-card rounded-lg ${severityBorderClass[issue.severity]}`}
                >
                  <h3 className="text-sm font-medium text-foreground mb-1">{issue.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </AppShell>
  );
};

export default Technical;
