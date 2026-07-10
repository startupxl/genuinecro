import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Lock, Play, RefreshCw, ArrowRight, AlertTriangle, GitBranch } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import {
  createFunnel, getFunnels, deleteFunnel, createFunnelRun, getFunnelRuns,
  type Funnel, type FunnelStep, type FunnelRun, type FunnelRunStep, type FunnelInsights,
} from "@/lib/firebase/funnels";
import { runMergedAudit } from "@/lib/mergedAudit";
import { createActionItems } from "@/lib/firebase/actionItems";
import { analyzeFunnel } from "@/lib/api/funnelInsights";
import { getGA4PageMetrics } from "@/lib/api/ga4";
import { extractCategoryScores, detectPageType } from "@/lib/mockData";
import { toast } from "sonner";

const MIN_STEPS = 2;
const MAX_STEPS = 6;

function formatUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return `https://${trimmed}`;
  return trimmed;
}

const emptyStep = (): FunnelStep => ({ label: "", url: "" });

const Funnels = () => {
  const { user } = useAuth();
  const capabilities = usePlanCapabilities();
  const { usage, trackAnalysis } = useUsageTracking();
  const upgradeMessage = getUpgradeMessage("funnels");

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [latestRuns, setLatestRuns] = useState<Record<string, FunnelRun>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<FunnelStep[]>([emptyStep(), emptyStep()]);
  const [saving, setSaving] = useState(false);

  const [runningFunnelId, setRunningFunnelId] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const funnelList = await getFunnels(user.uid);
      setFunnels(funnelList);
      const runEntries = await Promise.all(
        funnelList.map(async (funnel) => [funnel.id, (await getFunnelRuns(user.uid, funnel.id))[0]] as const)
      );
      setLatestRuns(Object.fromEntries(runEntries.filter(([, run]) => run !== undefined)));
    } catch (err) {
      console.error("Failed to load funnels:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view funnels.</p>
        </div>
      </AppShell>
    );
  }

  if (capabilities.isLoading) {
    return <AppShell><div className="p-6" /></AppShell>;
  }

  if (!capabilities.canFunnelAnalysis) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl">
          <h1 className="text-xl font-semibold text-foreground font-display mb-1">Funnels</h1>
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

  const builderValid =
    name.trim().length > 0 && steps.every((step) => step.label.trim().length > 0 && step.url.trim().length > 0);

  const handleCreate = async () => {
    if (!builderValid) return;
    setSaving(true);
    try {
      await createFunnel(
        user.uid,
        name.trim(),
        steps.map((step) => ({ label: step.label.trim(), url: formatUrl(step.url) }))
      );
      setName("");
      setSteps([emptyStep(), emptyStep()]);
      setShowBuilder(false);
      toast.success("Funnel created");
      await load();
    } catch (err) {
      toast.error("Couldn't create the funnel", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (funnelId: string) => {
    await deleteFunnel(funnelId);
    setFunnels((prev) => prev.filter((f) => f.id !== funnelId));
    toast.success("Funnel deleted");
  };

  const handleRun = async (funnel: Funnel) => {
    const remaining = usage.limit - usage.used;
    if (remaining < funnel.steps.length) {
      toast.error(`This funnel needs ${funnel.steps.length} audits but only ${remaining} remain in your plan this period.`);
      return;
    }

    setRunningFunnelId(funnel.id);
    try {
      const runSteps: FunnelRunStep[] = [];
      for (const [i, step] of funnel.steps.entries()) {
        setRunProgress(`Auditing step ${i + 1} of ${funnel.steps.length}: ${step.label}…`);
        const type = detectPageType(step.url);
        const result = await runMergedAudit(step.url, type, "desktop", null, undefined);
        const analysisId = await trackAnalysis(
          step.url,
          type,
          "desktop",
          result.conversionScore,
          extractCategoryScores(result.benchmark),
          result.technicalScore ?? undefined
        );
        await createActionItems(user.uid, step.url, type, result.frictionPoints);
        const topIssues = [...result.frictionPoints]
          .sort((a, b) => b.impactScore - a.impactScore)
          .slice(0, 3)
          .map((fp) => fp.title);

        let ga4: FunnelRunStep["ga4"] = null;
        if (capabilities.canGA4Integration) {
          try {
            const metrics = await getGA4PageMetrics(user, step.url);
            if (metrics.connected && metrics.behavioral) {
              ga4 = {
                bounceRate: metrics.behavioral.bounceRate,
                engagementRate: metrics.behavioral.engagementRate,
                sessions: metrics.behavioral.sessions,
              };
            }
          } catch (err) {
            console.error("GA4 metrics fetch failed for funnel step:", err);
          }
        }

        runSteps.push({ label: step.label, url: step.url, score: result.conversionScore, analysisId, topIssues, ga4 });
      }

      setRunProgress("Analyzing the funnel as a sequence…");
      let insights: FunnelInsights | null = null;
      try {
        insights = await analyzeFunnel(runSteps.map(({ label, url, score, topIssues }) => ({ label, url, score, topIssues })));
      } catch (err) {
        console.error("Funnel insights failed:", err);
        toast.warning("Step audits finished, but the funnel-level analysis failed.");
      }

      const runId = await createFunnelRun({ userId: user.uid, funnelId: funnel.id, steps: runSteps, insights });
      setLatestRuns((prev) => ({
        ...prev,
        [funnel.id]: { id: runId, userId: user.uid, funnelId: funnel.id, steps: runSteps, insights, createdAt: new Date().toISOString() },
      }));
      toast.success(`Funnel analysis complete for ${funnel.name}`);
    } catch (err) {
      toast.error("Funnel run failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setRunningFunnelId(null);
      setRunProgress("");
    }
  };

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-foreground font-display">Funnels</h1>
          <button
            onClick={() => setShowBuilder((v) => !v)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Funnel
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Audit a whole conversion path — every step gets a full audit, then the sequence itself is analyzed for where buyers leak out.
        </p>

        {showBuilder && (
          <div className="bg-surface border border-border rounded-lg p-4 mb-6 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Funnel name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Signup funnel"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Steps, in the order a visitor moves through them</label>
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 flex-shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))}
                    placeholder="Step label"
                    className="w-36 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-shrink-0"
                    disabled={saving}
                  />
                  <input
                    type="text"
                    value={step.url}
                    onChange={(e) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)))}
                    placeholder="https://…"
                    className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground min-w-0"
                    disabled={saving}
                  />
                  {steps.length > MIN_STEPS && (
                    <button
                      type="button"
                      onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove step ${i + 1}`}
                      className="text-muted-foreground hover:text-friction-high transition-colors flex-shrink-0"
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {steps.length < MAX_STEPS && (
                <button
                  type="button"
                  onClick={() => setSteps((prev) => [...prev, emptyStep()])}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                  disabled={saving}
                >
                  + Add step
                </button>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={saving || !builderValid}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Funnel"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading funnels…</p>
        ) : loadError ? (
          <p className="text-sm text-friction-high">Couldn't load your funnels. Please try refreshing the page.</p>
        ) : funnels.length === 0 ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>No funnels yet — create one to audit a full conversion path.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {funnels.map((funnel) => {
              const run = latestRuns[funnel.id];
              const isRunning = runningFunnelId === funnel.id;
              return (
                <div key={funnel.id} data-testid="funnel-card" className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{funnel.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {funnel.steps.map((s) => s.label).join(" → ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRun(funnel)}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        {isRunning ? "Running…" : "Run analysis"}
                      </button>
                      <button
                        onClick={() => handleDelete(funnel.id)}
                        disabled={isRunning}
                        aria-label={`Delete ${funnel.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-friction-high transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isRunning && runProgress && (
                    <p className="text-xs text-muted-foreground mt-2">{runProgress}</p>
                  )}

                  {run && !isRunning && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                      <div className="flex items-stretch gap-2 flex-wrap">
                        {run.steps.map((step, i) => {
                          const isWeakest = run.insights?.weakestStepIndex === i;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div
                                className={`rounded-md border p-2.5 min-w-[110px] ${
                                  isWeakest ? "border-friction-high bg-friction-high/5" : "border-border bg-background"
                                }`}
                              >
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{step.label}</p>
                                <p className="text-lg font-semibold text-foreground">
                                  {step.score}
                                  <span className="text-[10px] font-normal text-muted-foreground">/100</span>
                                </p>
                                {isWeakest && (
                                  <p className="text-[9px] font-medium text-friction-high flex items-center gap-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5" /> Weakest step
                                  </p>
                                )}
                                {step.ga4 && (
                                  <p className="text-[9px] text-muted-foreground">{step.ga4.bounceRate}% bounce</p>
                                )}
                                {step.analysisId && (
                                  <Link to={`/audits/${step.analysisId}`} className="text-[10px] text-primary hover:underline">
                                    View audit
                                  </Link>
                                )}
                              </div>
                              {i < run.steps.length - 1 && (
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {run.insights && (
                        <div className="space-y-3">
                          <div className="bg-primary/[0.04] border border-primary/20 rounded-lg p-3">
                            <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Funnel Verdict</p>
                            <p className="text-sm text-foreground">{run.insights.summary}</p>
                          </div>
                          {run.insights.transitionIssues.length > 0 && (
                            <div className="bg-background border border-border rounded-lg p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Step-to-Step Issues</p>
                              <ul className="space-y-1">
                                {run.insights.transitionIssues.map((issue, i) => (
                                  <li key={i} className="text-sm text-foreground">• {issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {run.insights.recommendations.length > 0 && (
                            <div className="bg-background border border-border rounded-lg p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Fixes by Revenue Impact</p>
                              <ol className="space-y-1">
                                {run.insights.recommendations.map((rec, i) => (
                                  <li key={i} className="text-sm text-foreground">{i + 1}. {rec}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Funnels;
